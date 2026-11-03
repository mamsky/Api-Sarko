/**
 * Tanggal bisnis (business date) — PRD §7.4, §9.2b.
 *
 * Outlet tutup lewat tengah malam: transaksi jam 01:30 dengan cutoff 04:00
 * masih milik tanggal bisnis kemarin. Laporan, blok nomor order, dan
 * rekonsiliasi shift semuanya memakai nilai ini, bukan tanggal kalender.
 *
 * Implementasi murni `Intl.DateTimeFormat.formatToParts` — tanpa date library,
 * tanpa asumsi offset tetap, sehingga aman untuk zona apa pun (termasuk DST).
 */

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Jakarta';

type DateParts = { year: number; month: number; day: number; hour: number };

function partsInTimezone(at: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (found === undefined) {
      throw new Error(`Zona waktu "${timeZone}" tidak mengembalikan bagian "${type}"`);
    }
    return Number.parseInt(found.value, 10);
  };

  // `hour12: false` pada beberapa ICU mengembalikan "24" untuk tengah malam.
  const hour = read('hour') % 24;
  return { year: read('year'), month: read('month'), day: read('day'), hour };
}

function toIsoDate(year: number, month: number, day: number): string {
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Geser tanggal kalender murni (tanpa zona waktu) sebanyak `days`. */
function shiftCalendarDate(year: number, month: number, day: number, days: number): string {
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * Hitung tanggal bisnis untuk sebuah instant.
 *
 * @param at         Instant (UTC) kejadian.
 * @param cutoffHour Jam tutup outlet dalam waktu lokal (0-23). Jam lokal
 *                   sebelum cutoff dihitung sebagai hari sebelumnya.
 * @param timeZone   Zona waktu outlet.
 */
export function businessDate(
  at: Date,
  cutoffHour: number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  if (Number.isNaN(at.getTime())) {
    throw new Error('businessDate menerima Date yang tidak valid');
  }
  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > 23) {
    throw new Error(`cutoffHour harus integer 0-23, diterima: ${cutoffHour}`);
  }

  const { year, month, day, hour } = partsInTimezone(at, timeZone);
  if (hour < cutoffHour) {
    return shiftCalendarDate(year, month, day, -1);
  }
  return toIsoDate(year, month, day);
}

/** Tanggal bisnis "sekarang" memakai jam sistem. */
export function currentBusinessDate(
  cutoffHour: number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
  now: Date = new Date(),
): string {
  return businessDate(now, cutoffHour, timeZone);
}

/**
 * Rentang instant [start, end) untuk sebuah tanggal bisnis.
 * Dipakai reporting: `WHERE created_at >= start AND created_at < end`.
 */
export function businessDateRange(
  date: string,
  cutoffHour: number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new Error(`Tanggal bisnis harus berformat YYYY-MM-DD, diterima: ${date}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Cari instant pertama yang tanggal bisnisnya = `date`.
  // Mulai dari tengah malam lokal tanggal itu, lalu koreksi bila cutoff > 0.
  const guess = zonedMidnight(year, month, day, timeZone);
  const start =
    businessDate(guess, cutoffHour, timeZone) === date
      ? guess
      : zonedMidnight(year, month, day, timeZone, cutoffHour);

  const nextDate = shiftCalendarDate(year, month, day, 1);
  const nextMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextDate);
  const end = zonedMidnight(
    Number(nextMatch?.[1] ?? year),
    Number(nextMatch?.[2] ?? month),
    Number(nextMatch?.[3] ?? day),
    timeZone,
    cutoffHour,
  );

  return { start, end };
}

/**
 * Konversi wall-clock lokal (Y-M-D H:00) ke instant UTC untuk zona tertentu.
 * Memakai iterasi koreksi offset — cukup dua langkah dan bebas DST.
 */
function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
  hour = 0,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let instant = new Date(target);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsInTimezone(instant, timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, 0, 0, 0);
    const drift = target - localAsUtc;
    if (drift === 0) {
      break;
    }
    instant = new Date(instant.getTime() + drift);
  }

  return instant;
}

/** Format `YYYY-MM-DD` untuk tanggal bisnis hari ini (helper controller/service). */
export function todayBusinessDate(cutoffHour: number, timeZone?: string): string {
  return currentBusinessDate(cutoffHour, timeZone);
}
