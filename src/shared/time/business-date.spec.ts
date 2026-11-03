import { businessDate, businessDateRange, currentBusinessDate } from './business-date';

describe('businessDate', () => {
  it('memakai tanggal kalender saat jam lokal >= cutoff', () => {
    // 2026-11-02T05:00:00+07:00 === 2026-11-01T22:00:00Z
    const at = new Date('2026-11-01T22:00:00Z');
    expect(businessDate(at, 4, 'Asia/Jakarta')).toBe('2026-11-02');
  });

  it('memundurkan satu hari saat jam lokal < cutoff', () => {
    // 2026-11-02T01:30:00+07:00 === 2026-11-01T18:30:00Z
    const at = new Date('2026-11-01T18:30:00Z');
    expect(businessDate(at, 4, 'Asia/Jakarta')).toBe('2026-11-01');
  });

  it('tepat pada cutoff dihitung sebagai hari baru', () => {
    // 2026-11-02T04:00:00+07:00 === 2026-11-01T21:00:00Z
    const at = new Date('2026-11-01T21:00:00Z');
    expect(businessDate(at, 4, 'Asia/Jakarta')).toBe('2026-11-02');
  });

  it('Asia/Jakarta tidak punya DST sehingga offset stabil sepanjang tahun', () => {
    const january = businessDate(new Date('2026-01-15T03:00:00Z'), 0, 'Asia/Jakarta');
    const july = businessDate(new Date('2026-07-15T03:00:00Z'), 0, 'Asia/Jakarta');
    expect(january).toBe('2026-01-15');
    expect(july).toBe('2026-07-15');
  });

  it('menyeberangi pergantian bulan dan tahun dengan benar', () => {
    // 2027-01-01T02:00:00+07:00 === 2026-12-31T19:00:00Z
    expect(businessDate(new Date('2026-12-31T19:00:00Z'), 4, 'Asia/Jakarta')).toBe('2026-12-31');
    // 2026-03-01T03:00:00+07:00 === 2026-02-28T20:00:00Z
    expect(businessDate(new Date('2026-02-28T20:00:00Z'), 4, 'Asia/Jakarta')).toBe('2026-02-28');
  });

  it('menghormati zona waktu lain (New York, dengan DST)', () => {
    // 2026-07-01T02:00:00Z === 2026-06-30T22:00:00-04:00
    expect(businessDate(new Date('2026-07-01T02:00:00Z'), 4, 'America/New_York')).toBe('2026-06-30');
    // 2026-01-01T02:00:00Z === 2025-12-31T21:00:00-05:00
    expect(businessDate(new Date('2026-01-01T02:00:00Z'), 4, 'America/New_York')).toBe('2025-12-31');
  });

  it('melempar untuk cutoffHour di luar 0-23', () => {
    expect(() => businessDate(new Date(), 24)).toThrow(/cutoffHour/);
    expect(() => businessDate(new Date(), -1)).toThrow(/cutoffHour/);
  });

  it('currentBusinessDate memakai jam yang diberikan', () => {
    const now = new Date('2026-11-01T18:30:00Z'); // 01:30 WIB
    expect(currentBusinessDate(4, 'Asia/Jakarta', now)).toBe('2026-11-01');
    expect(currentBusinessDate(0, 'Asia/Jakarta', now)).toBe('2026-11-02');
  });

  it('businessDateRange menghasilkan rentang [start, end) yang konsisten', () => {
    const { start, end } = businessDateRange('2026-11-02', 4, 'Asia/Jakarta');
    expect(businessDate(start, 4, 'Asia/Jakarta')).toBe('2026-11-02');
    expect(businessDate(new Date(end.getTime() - 1), 4, 'Asia/Jakarta')).toBe('2026-11-02');
    expect(businessDate(end, 4, 'Asia/Jakarta')).toBe('2026-11-03');
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
