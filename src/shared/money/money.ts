/**
 * Uang di SARKO selalu integer rupiah penuh (PRD §9.2, plan §2.4).
 *
 * Tidak ada konversi string-ke-float, tidak ada pembulatan implisit, tidak ada desimal.
 * Semua operasi yang bisa menghasilkan pecahan membulatkan secara eksplisit
 * dengan `Math.round` agar hasilnya deterministik dan bisa diaudit.
 */

/** Alias semantik: angka rupiah integer. */
export type Rupiah = number;

/** Batas atas sama dengan kontrak (`MAX_RUPIAH`) — guard terhadap overflow/typo. */
export const MAX_RUPIAH = 1_000_000_000_000;

/**
 * Pastikan nilai adalah integer terbatas. Melempar untuk input non-integer
 * supaya bug pembulatan ketahuan di sumbernya, bukan di total transaksi.
 */
export function assertInteger(value: number, label = 'nilai'): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} harus integer rupiah, diterima: ${String(value)}`);
  }
}

/** Penjumlahan dua nominal integer. */
export function add(a: Rupiah, b: Rupiah): Rupiah {
  assertInteger(a, 'a');
  assertInteger(b, 'b');
  return a + b;
}

/** Pengurangan dua nominal integer (boleh negatif — dipakai untuk koreksi/refund). */
export function subtract(a: Rupiah, b: Rupiah): Rupiah {
  assertInteger(a, 'a');
  assertInteger(b, 'b');
  return a - b;
}

/**
 * Perkalian nominal dengan faktor bilangan bulat (qty).
 * Faktor wajib integer agar tidak ada pecahan tersembunyi.
 */
export function multiply(amount: Rupiah, factor: number): Rupiah {
  assertInteger(amount, 'amount');
  assertInteger(factor, 'factor');
  return amount * factor;
}

/**
 * Persentase dalam basis points: `percent(18000, 1000) === 1800` (10%).
 *
 * Basis points dipakai karena tarif pajak (PB1 10%) disimpan sebagai integer
 * `rate_bps` di `tax_config` — tidak ada float di jalur uang sama sekali.
 */
export function percent(amount: Rupiah, rateBps: number): Rupiah {
  assertInteger(amount, 'amount');
  assertInteger(rateBps, 'rateBps');
  return Math.round((amount * rateBps) / 10_000);
}

/** Jumlahkan daftar nominal. */
export function sum(amounts: readonly Rupiah[]): Rupiah {
  return amounts.reduce((total, amount) => add(total, amount), 0);
}

/**
 * Pembulatan ke kelipatan terdekat (half-up), default Rp 100 (PRD FR-PAY-05).
 * Selisihnya dicatat sebagai `rounding_adjustment` oleh pemanggil.
 */
export function roundToNearest(amount: Rupiah, step = 100): Rupiah {
  assertInteger(amount, 'amount');
  assertInteger(step, 'step');
  if (step <= 0) {
    throw new Error('step pembulatan harus > 0');
  }
  return Math.round(amount / step) * step;
}

/** Selisih pembulatan yang harus dicatat agar total tetap konsisten. */
export function roundingAdjustment(amount: Rupiah, step = 100): Rupiah {
  return roundToNearest(amount, step) - amount;
}

/** Format tampilan Indonesia: `18000` → `"Rp 18.000"`. */
export function formatRupiah(amount: Rupiah): string {
  assertInteger(amount, 'amount');
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${digits}`;
}
