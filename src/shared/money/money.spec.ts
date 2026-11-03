import { assertInteger, add, formatRupiah, MAX_RUPIAH, multiply, percent, roundToNearest, roundingAdjustment, subtract, sum } from './money';

describe('money (integer rupiah)', () => {
  it('menjumlahkan dua nominal', () => {
    expect(add(18_000, 2_000)).toBe(20_000);
  });

  it('mengurangkan nominal dan mengizinkan hasil negatif', () => {
    expect(subtract(18_000, 20_000)).toBe(-2_000);
  });

  it('mengalikan nominal dengan qty integer', () => {
    expect(multiply(18_000, 3)).toBe(54_000);
  });

  it('percent(18000, 1000) === 1800 — PB1 10%', () => {
    expect(percent(18_000, 1000)).toBe(1_800);
  });

  it('percent membulatkan half-up, bukan memotong', () => {
    // 15.000 * 1100 bps = 1650 tepat; 1.234 * 1000 bps = 123,4 -> 123
    expect(percent(1_234, 1000)).toBe(123);
    // 1.235 * 1000 bps = 123,5 -> 124 (half-up)
    expect(percent(1_235, 1000)).toBe(124);
  });

  it('percent dengan tarif 0 menghasilkan 0', () => {
    expect(percent(999_999, 0)).toBe(0);
  });

  it('melempar untuk nominal non-integer', () => {
    expect(() => add(1.5, 100)).toThrow(/integer/);
    expect(() => percent(18_000.75, 1000)).toThrow(/integer/);
    expect(() => multiply(18_000, 1.5)).toThrow(/integer/);
  });

  it('melempar untuk NaN dan Infinity', () => {
    expect(() => assertInteger(Number.NaN)).toThrow(/integer/);
    expect(() => assertInteger(Number.POSITIVE_INFINITY)).toThrow(/integer/);
  });

  it('sum menjumlahkan daftar', () => {
    expect(sum([18_000, 2_000, 500])).toBe(20_500);
    expect(sum([])).toBe(0);
  });

  it('formatRupiah memakai pemisah ribuan Indonesia', () => {
    expect(formatRupiah(18_000)).toBe('Rp 18.000');
    expect(formatRupiah(1_234_567)).toBe('Rp 1.234.567');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-2_500)).toBe('-Rp 2.500');
  });

  it('roundToNearest membulatkan ke Rp 100 terdekat (half-up)', () => {
    expect(roundToNearest(19_849)).toBe(19_800);
    expect(roundToNearest(19_850)).toBe(19_900);
    expect(roundToNearest(19_851)).toBe(19_900);
  });

  it('roundingAdjustment adalah selisih yang harus dicatat', () => {
    expect(roundingAdjustment(19_849)).toBe(-49);
    expect(roundingAdjustment(19_850)).toBe(50);
  });

  it('MAX_RUPIAH selaras dengan kontrak', () => {
    expect(MAX_RUPIAH).toBe(1_000_000_000_000);
  });

  it('tidak memakai konversi float di jalur uang', () => {
    // Guard regresi: file sumber tidak boleh mengandung konversi string-ke-float.
    const source = require('node:fs').readFileSync(require.resolve('./money.ts'), 'utf8') as string;
    const forbidden = ['parse' + 'Float', 'to' + 'Fixed', 'Number.' + 'parseFloat'];
    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });
});
