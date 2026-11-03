import type { CachedResult } from './idempotency.service';

/**
 * Hasil pemeriksaan idempotensi yang ditempelkan guard ke request.
 *
 * Kenapa tidak dilempar sebagai exception dari guard: di NestJS guard berjalan
 * SEBELUM interceptor, jadi exception dari guard tidak bisa ditangkap
 * interceptor. Guard menaruh keputusan di sini, interceptor yang
 * mem-persingkat request dan menyimpan response.
 */
export type IdempotencyContext = {
  key: string;
  actorId: string;
  requestHash: string;
  cached: CachedResult | null;
};

export const IDEMPOTENCY_REQUEST_KEY = '__sarko_idempotency';

type RequestWithIdempotency = Record<string, unknown>;

export function attachIdempotency(
  request: RequestWithIdempotency,
  context: IdempotencyContext,
): void {
  request[IDEMPOTENCY_REQUEST_KEY] = context;
}

export function readIdempotency(request: RequestWithIdempotency): IdempotencyContext | null {
  const value = request[IDEMPOTENCY_REQUEST_KEY];
  return isIdempotencyContext(value) ? value : null;
}

function isIdempotencyContext(value: unknown): value is IdempotencyContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<IdempotencyContext>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.actorId === 'string' &&
    typeof candidate.requestHash === 'string'
  );
}
