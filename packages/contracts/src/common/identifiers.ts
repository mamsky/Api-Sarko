import { z } from 'zod';

/**
 * Identifier primitives — didefinisikan sekali, dipakai seluruh kontrak.
 * ULID dipakai untuk ID yang dibuat client offline (harus sortable & unik tanpa server).
 */

/** Crockford Base32, 26 karakter, tanpa I/L/O/U. */
export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const ulidSchema = z
  .string()
  .regex(ULID_REGEX, 'Harus ULID 26 karakter (Crockford Base32)')
  .describe('ULID 26 karakter');

export const uuidSchema = z.string().uuid().describe('UUID v4');

export type Ulid = z.infer<typeof ulidSchema>;
export type Uuid = z.infer<typeof uuidSchema>;

/** ISO-8601 date-time dengan offset eksplisit — dipakai untuk timestamp dari device. */
export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe('ISO-8601 date-time dengan timezone offset');

/** Tanggal bisnis (bukan tanggal kalender biasa): YYYY-MM-DD, mengikuti jam tutup outlet. */
export const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format business_date harus YYYY-MM-DD')
  .describe('Tanggal bisnis outlet, format YYYY-MM-DD');
