import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { HttpRequestLike, HttpResponseLike } from '../http/http.types';
import { type Observable, from, of, switchMap, tap } from 'rxjs';

import { readIdempotency } from './idempotency-context';
import { IdempotencyService } from './idempotency.service';

/**
 * Mem-persingkat replay idempotensi dan menyimpan response pertama.
 *
 * - Request replay → response tersimpan dikirim verbatim, handler TIDAK dijalankan.
 * - Request baru → response 2xx/4xx disimpan agar replay berikutnya identik.
 *   Response 5xx tidak disimpan: request berikutnya harus benar-benar dicoba lagi.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();
    const state = readIdempotency(request as unknown as Record<string, unknown>);

    if (state === null) {
      return next.handle();
    }

    if (state.cached !== null) {
      response.status(state.cached.statusCode);
      return of(state.cached.responseBody);
    }

    return next.handle().pipe(
      switchMap((body) =>
        from(
          this.idempotency.store(state.key, state.actorId, {
            statusCode: response.statusCode,
            responseBody: body ?? null,
          }),
        ).pipe(switchMap(() => of(body))),
      ),
      tap({
        error: (error: unknown) => {
          const status = extractStatus(error);
          if (status >= 400 && status < 500) {
            void this.idempotency
              .store(state.key, state.actorId, {
                statusCode: status,
                responseBody: toProblemBody(error),
              })
              .catch((storeError: unknown) => {
                this.logger.warn({ err: storeError }, 'Gagal menyimpan response error idempotensi');
              });
          }
        },
      }),
    );
  }
}

function extractStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return 500;
}

function toProblemBody(error: unknown): unknown {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; detail?: unknown; title?: unknown };
    if (typeof candidate.code === 'string') {
      return { code: candidate.code, detail: candidate.detail, title: candidate.title };
    }
  }
  return null;
}
