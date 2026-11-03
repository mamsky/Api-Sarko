import { Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../database/drizzle.service';
import { stockLevel, stockMovement } from '../../database/schema';
import { AppError } from '../../shared/errors/app-error';
import { InventoryRepository, type BomLine, type StockShortage } from './repositories/inventory.repository';

export type ReserveResult = {
  reserved: boolean;
  shortages: StockShortage[];
};

export type DeductLine = {
  ingredientId: string;
  ingredientName: string;
  qty: number;
  unit: string;
  qtyAfter: number;
};

/**
 * Logika inventaris (PRD FR-INV).
 *
 * Semua method menerima `tx` dari pemanggil agar perubahan stok dan order
 * commit/rollback bersama — tidak ada stok yang terpotong untuk order gagal.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly repository: InventoryRepository) {}

  /**
   * Reservasi stok saat order masuk `PENDING_PAYMENT` (PRD §7.4.2).
   * Tidak melempar saat kurang: reservasi dicatat sebisanya dan kekurangan
   * dikembalikan agar pemanggil bisa memberi peringatan.
   */
  async reserve(tx: Database, orderId: string, outletId: string, items: BomRequest[]): Promise<ReserveResult> {
    const requirements = await this.explodeBom(tx, items);
    const shortages: StockShortage[] = [];

    for (const [ingredientId, required] of requirements) {
      const available = await this.repository.getStock(tx, outletId, ingredientId);
      if (available < required) {
        shortages.push({
          ingredientId,
          ingredientName: ingredientId,
          required,
          available,
          unit: '',
        });
      }
      await this.repository.upsertReservation(tx, {
        outletId,
        orderId,
        ingredientId,
        qty: String(required),
        status: 'ACTIVE',
      });
    }

    return { reserved: shortages.length === 0, shortages };
  }

  /**
   * Potong stok saat order `PAID` (PRD B5).
   *
   * Stok BOLEH menjadi negatif: transaksi sudah dibayar, menolak memotong
   * hanya membuat data stok bohong. Nilai negatif = sinyal stock opname.
   * Setiap potongan menulis `stock_movement` append-only.
   */
  async deduct(tx: Database, orderId: string, outletId: string, items: BomRequest[], actorId?: string): Promise<DeductLine[]> {
    const requirements = await this.explodeBom(tx, items);
    const deducted: DeductLine[] = [];

    for (const [ingredientId, qty] of requirements) {
      const qtyAfter = await this.repository.upsertStock(tx, outletId, ingredientId, -qty);

      await this.repository.recordMovement(tx, {
        outletId,
        ingredientId,
        orderId,
        type: 'SALE',
        qtyDelta: String(-qty),
        qtyAfter: String(qtyAfter),
        reference: orderId,
        actorId: actorId ?? null,
      });

      deducted.push({
        ingredientId,
        ingredientName: ingredientId,
        qty,
        unit: '',
        qtyAfter,
      });

      if (qtyAfter < 0) {
        this.logger.warn({ ingredientId, qtyAfter, orderId }, 'Stok negatif setelah pemotongan');
      }
    }

    await this.repository.releaseReservations(tx, orderId);
    return deducted;
  }

  /** Kembalikan stok saat refund/void setelah bayar (opsional, configurable). */
  async restore(tx: Database, orderId: string, outletId: string, items: BomRequest[], actorId?: string): Promise<void> {
    const requirements = await this.explodeBom(tx, items);

    for (const [ingredientId, qty] of requirements) {
      const qtyAfter = await this.repository.upsertStock(tx, outletId, ingredientId, qty);
      await this.repository.recordMovement(tx, {
        outletId,
        ingredientId,
        orderId,
        type: 'REFUND_RESTORE',
        qtyDelta: String(qty),
        qtyAfter: String(qtyAfter),
        reference: orderId,
        actorId: actorId ?? null,
      });
    }
  }

  /** Hitung ulang stok dari seluruh movement (job pemeliharaan). */
  async recalculate(tx: Database, outletId: string, ingredientId: string): Promise<number> {
    const rows = await tx
      .select({ total: sql<string>`coalesce(sum(${stockMovement.qtyDelta}), 0)` })
      .from(stockMovement)
      .where(
        and(eq(stockMovement.outletId, outletId), eq(stockMovement.ingredientId, ingredientId)),
      );

    const total = Number(rows[0]?.total ?? 0);
    await tx
      .insert(stockLevel)
      .values({ outletId, ingredientId, qtyOnHand: String(total) })
      .onConflictDoUpdate({
        target: [stockLevel.outletId, stockLevel.ingredientId],
        set: { qtyOnHand: String(total), updatedAt: new Date() },
      });

    return total;
  }

  async lowStock(outletId: string, threshold = 0) {
    if (!Number.isFinite(threshold)) {
      throw AppError.validation('Threshold stok harus angka');
    }
    return this.repository.listLowStock(outletId, threshold);
  }

  async listStock(outletId: string) {
    return this.repository.listIngredientsWithStock(outletId);
  }

  /** Kebutuhan bahan untuk satu produk, sudah dikali qty order dan dibagi yield resep. */
  async bomForProduct(tx: Database, productId: string, qty: number): Promise<BomLine[]> {
    const recipe = await this.repository.findRecipeByProductId(tx, productId);
    if (recipe === undefined) {
      return [];
    }
    const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
    return recipe.lines.map((line) => ({
      ...line,
      qtyPerUnit: (line.qtyPerUnit * qty) / yieldQty,
    }));
  }

  private async explodeBom(tx: Database, items: BomRequest[]): Promise<Map<string, number>> {
    const requirements = new Map<string, number>();

    for (const item of items) {
      const lines = await this.bomForProduct(tx, item.productId, item.qty);
      for (const line of lines) {
        const current = requirements.get(line.ingredientId) ?? 0;
        requirements.set(line.ingredientId, current + line.qtyPerUnit);
      }
    }

    return requirements;
  }
}

export type BomRequest = { productId: string; qty: number };
