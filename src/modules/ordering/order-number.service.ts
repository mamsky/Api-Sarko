import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../database/drizzle.service';
import { numberBlock } from '../../database/schema';
import { AppError } from '../../shared/errors/app-error';
import { newId } from '../../shared/id/id';

export type AllocateBlockInput = {
  outletId: string;
  deviceId?: string | null;
  shiftId?: string | null;
  prefix: string;
  size?: number;
};

export type NumberBlockRow = {
  id: string;
  rangeStart: number;
  rangeEnd: number;
  nextValue: number;
};

const DEFAULT_BLOCK_SIZE = 200;

/**
 * Alokasi & pemakaian blok nomor order (PRD §9.2b).
 *
 * Rentang untuk `(outlet_id, prefix)` TIDAK BOLEH tumpang tindih. Jaminannya:
 * `SELECT ... FOR UPDATE` pada baris blok yang sudah ada untuk pasangan itu,
 * sehingga dua device yang minta blok bersamaan antre dan `range_start`
 * dihitung dari `MAX(range_end)` yang sudah terkunci.
 */
@Injectable()
export class OrderNumberService {
  /**
   * Alokasikan blok baru. Harus dipanggil DI DALAM transaksi pemanggil
   * agar lock dan insert commit bersama.
   */
  async allocateBlock(tx: Database, input: AllocateBlockInput): Promise<NumberBlockRow> {
    const size = input.size ?? DEFAULT_BLOCK_SIZE;
    if (!Number.isInteger(size) || size <= 0) {
      throw AppError.validation('Ukuran blok nomor harus integer > 0');
    }

    // Raw SQL hanya untuk `FOR UPDATE` — Drizzle query builder belum punya
    // klausa row lock. Ini satu-satunya tempat SQL mentah di file ini.
    const locked = await tx.execute(sql`
      SELECT range_end
      FROM number_block
      WHERE outlet_id = ${input.outletId} AND prefix = ${input.prefix}
      ORDER BY range_end DESC
      LIMIT 1
      FOR UPDATE
    `);

    const rows = locked.rows as { range_end: string | number }[];
    const maxRangeEnd = rows.length > 0 ? Number(rows[0]?.range_end ?? 0) : 0;

    const rangeStart = maxRangeEnd + 1;
    const rangeEnd = rangeStart + size - 1;
    const id = newId();

    await tx.insert(numberBlock).values({
      id,
      outletId: input.outletId,
      deviceId: input.deviceId ?? null,
      shiftId: input.shiftId ?? null,
      prefix: input.prefix,
      rangeStart,
      rangeEnd,
      nextValue: rangeStart,
      status: 'ACTIVE',
    });

    return { id, rangeStart, rangeEnd, nextValue: rangeStart };
  }

  /**
   * Ambil satu nomor dari blok secara atomik.
   * `UPDATE ... WHERE next_value <= range_end RETURNING next_value - 1`
   * menjamin tidak ada dua pemanggil mendapat nomor yang sama.
   */
  async consume(tx: Database, blockId: string): Promise<number> {
    const updated = await tx
      .update(numberBlock)
      .set({
        nextValue: sql`${numberBlock.nextValue} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(numberBlock.id, blockId), sql`${numberBlock.nextValue} <= ${numberBlock.rangeEnd}`))
      .returning({
        consumed: sql<number>`${numberBlock.nextValue} - 1`,
        nextValue: numberBlock.nextValue,
        rangeEnd: numberBlock.rangeEnd,
        status: numberBlock.status,
      });

    const row = updated[0];
    if (row === undefined) {
      throw AppError.conflict('Blok nomor sudah habis atau tidak ditemukan');
    }

    if (row.nextValue > row.rangeEnd) {
      await tx
        .update(numberBlock)
        .set({ status: 'EXHAUSTED', updatedAt: new Date() })
        .where(eq(numberBlock.id, blockId));
    }

    return Number(row.consumed);
  }

  /** Kembalikan sisa blok saat shift tutup (PRD: status RETURNED). */
  async returnBlock(tx: Database, blockId: string, lastUsed: number): Promise<void> {
    await tx
      .update(numberBlock)
      .set({
        status: 'RETURNED',
        nextValue: lastUsed + 1,
        returnedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(numberBlock.id, blockId));
  }

  async findActiveBlock(
    tx: Database,
    outletId: string,
    prefix: string,
  ): Promise<NumberBlockRow | undefined> {
    const rows = await tx
      .select({
        id: numberBlock.id,
        rangeStart: numberBlock.rangeStart,
        rangeEnd: numberBlock.rangeEnd,
        nextValue: numberBlock.nextValue,
      })
      .from(numberBlock)
      .where(
        and(
          eq(numberBlock.outletId, outletId),
          eq(numberBlock.prefix, prefix),
          eq(numberBlock.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    return rows[0];
  }
}

/**
 * Format nomor order tampil ke pelanggan: `OFF-KTA-P1-00042`
 * (PRD §9.2b: `OFF-<kode_outlet>-<kode_pos>-<5 digit>`).
 */
export function formatOrderNo(outletCode: string, deviceCode: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) {
    throw AppError.validation('Nomor urut order harus integer >= 0');
  }
  const outlet = sanitizeSegment(outletCode, 'OUT');
  const device = sanitizeSegment(deviceCode, 'P1');
  return `OFF-${outlet}-${device}-${String(seq).padStart(5, '0')}`;
}

/** Prefix blok nomor untuk pasangan outlet+device. */
export function blockPrefix(outletCode: string, deviceCode: string): string {
  return `${sanitizeSegment(outletCode, 'OUT')}-${sanitizeSegment(deviceCode, 'P1')}`;
}

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned.length > 0 ? cleaned : fallback;
}
