import { randomUUID } from 'node:crypto';

import { ulid } from 'ulid';

/** UUID v4 — ID entitas yang dibuat server (order, payment, dst). */
export function newId(): string {
  return randomUUID();
}

/**
 * ULID — ID perintah offline dari device (PRD §9.2b).
 * Sortable secara leksikografis berdasarkan waktu, jadi aman dipakai
 * sebagai kursor/idempotency key tanpa server.
 */
export function newCommandId(): string {
  return ulid();
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Validasi bentuk ULID (Crockford Base32, 26 karakter, tanpa I/L/O/U). */
export function isUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validasi bentuk UUID — dipakai untuk ID yang datang dari device, bukan dari server. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Kode human-readable untuk device/outlet: `KTA`, `P1`. */
export function slugCode(value: string, fallback = 'X'): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned.length > 0 ? cleaned : fallback;
}
