import type { Paginated } from '@sarko/contracts';

/**
 * Cursor keyset pagination (PRD §10) — bukan offset, karena insert di tengah
 * saat jam sibuk membuat offset melewatkan/menduplikasi baris.
 *
 * Cursor = base64url(`<ISO created_at>|<id>`).
 */
export type Cursor = { createdAt: Date; id: string };

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): Cursor {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new Error('Cursor tidak valid');
  }

  const separator = decoded.indexOf('|');
  if (separator <= 0) {
    throw new Error('Cursor tidak valid');
  }

  const createdAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    throw new Error('Cursor tidak valid');
  }
  return { createdAt, id };
}

/** Bungkus hasil query menjadi bentuk `Paginated<T>` kontrak. */
export function toPaginated<T extends { id: string; createdAt: Date }>(
  rows: readonly T[],
  limit: number,
  map: (row: T) => unknown,
): Paginated<unknown> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    data: page.map(map),
    next_cursor: hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
    has_more: hasMore,
  };
}

/** `limit` default 50, maksimum 100 (PRD §10). */
export function normalizeLimit(limit: number | undefined, fallback = 50): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}
