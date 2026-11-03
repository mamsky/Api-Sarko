import { createHash } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { HttpRequestLike } from '../http/http.types';

import { AppError } from '../errors/app-error';
import { attachIdempotency } from './idempotency-context';
import { IdempotencyService } from './idempotency.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HEADER = 'idempotency-key';

export type AuthenticatedRequest = HttpRequestLike & {
  user?: { id?: string; sub?: string };
};

/**
 * Guard idempotensi global (PRD FR-PAY-01, plan §2.1).
 *
 * Setiap request mutasi WAJIB membawa `Idempotency-Key`. Key yang sama dengan
 * body identik mengembalikan response tersimpan; body berbeda → 409.
 */
@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly logger = new Logger(IdempotencyGuard.name);

  constructor(private readonly idempotency: IdempotencyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!MUTATING_METHODS.has(request.method)) {
      return true;
    }

    if (isExempt(request)) {
      return true;
    }

    const key = readHeader(request, HEADER);
    if (key === undefined || key.length === 0) {
      throw AppError.idempotencyMissing();
    }
    if (key.length > 128) {
      throw AppError.validation('Idempotency-Key maksimal 128 karakter');
    }

    const actorId = resolveActorId(request);
    const requestHash = hashRequest(request);
    const decision = await this.idempotency.checkOrCreate(key, requestHash, actorId);

    if (decision.outcome === 'PROCEED') {
      attachIdempotency(request as unknown as Record<string, unknown>, {
        key,
        actorId,
        requestHash,
        cached: null,
      });
      return true;
    }

    const cached = decision.cached;
    if (cached.statusCode === 409 && cached.responseBody === null) {
      this.logger.warn({ key, actorId }, 'Idempotency-Key dipakai dengan payload berbeda');
      throw AppError.idempotencyReused();
    }

    attachIdempotency(request as unknown as Record<string, unknown>, {
      key,
      actorId,
      requestHash,
      cached,
    });
    return true;
  }
}

function readHeader(request: HttpRequestLike, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

/** Endpoint yang tidak boleh di-idempotensi: health, webhook (pakai signature sendiri), auth. */
function isExempt(request: HttpRequestLike): boolean {
  const path = request.path ?? request.url;
  return (
    path.startsWith('/v1/health') ||
    path.startsWith('/v1/payments/webhook') ||
    path.startsWith('/v1/auth/login') ||
    path.startsWith('/v1/auth/pin') ||
    path.startsWith('/docs')
  );
}

function resolveActorId(request: AuthenticatedRequest): string {
  const user = request.user;
  const id = user?.id ?? user?.sub;
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  // Belum terautentikasi (mis. login) — pakai IP sebagai aktor agar key tetap ter-scope.
  return `anon:${request.ip ?? 'unknown'}`;
}

/**
 * Hash kanonik dari method + path + body.
 * Key diurutkan agar `{a,b}` dan `{b,a}` menghasilkan hash yang sama.
 */
export function hashRequest(request: HttpRequestLike): string {
  const canonical = JSON.stringify({
    method: request.method,
    path: request.route?.path ?? request.path ?? request.url,
    body: canonicalize(request.body),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      result[key] = canonicalize(entry);
    }
    return result;
  }
  return value;
}
