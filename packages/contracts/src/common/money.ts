import { z } from 'zod';

/**
 * Uang di SARKO SELALU integer rupiah penuh.
 * Tidak ada desimal, tidak ada float, tidak ada sen.
 * Alasan: pembulatan float pada total transaksi F&B adalah sumber sengketa kasir.
 */
export const MAX_RUPIAH = 1_000_000_000_000; // Rp 1 triliun — guard terhadap overflow/typo input

export const rupiahSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_RUPIAH, `Nominal rupiah tidak boleh melebihi ${MAX_RUPIAH}`)
  .describe('Jumlah dalam rupiah penuh (integer), bukan desimal');

export const positiveRupiahSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_RUPIAH, `Nominal rupiah tidak boleh melebihi ${MAX_RUPIAH}`)
  .describe('Jumlah dalam rupiah penuh (integer) dan harus lebih besar dari 0');

export type Rupiah = z.infer<typeof rupiahSchema>;
export type PositiveRupiah = z.infer<typeof positiveRupiahSchema>;

const idrFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Format integer rupiah ke tampilan Indonesia: 18000 -> "Rp 18.000".
 * Pure function, tanpa dependensi — aman dipakai di server maupun client.
 */
export function formatRupiah(amount: number): string {
  return `Rp ${idrFormatter.format(amount)}`;
}
