import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import {
  ingredient,
  recipe,
  recipeItem,
  stockLevel,
  stockMovement,
  stockReservation,
} from '../../../database/schema';

export type BomLine = {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  qtyPerUnit: number;
  costPerUnit: number;
};

export type StockShortage = {
  ingredientId: string;
  ingredientName: string;
  required: number;
  available: number;
  unit: string;
};

/**
 * Inventaris & BOM (PRD FR-INV).
 *
 * Keputusan: stok BOLEH negatif saat `deduct`. Menolak transaksi yang sudah
 * dibayar lebih merugikan daripada mencatat stok negatif — nilai negatif
 * menjadi sinyal untuk stock opname, dan `lowStock()` menampilkannya.
 */
@Injectable()
export class InventoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findRecipeByProductId(
    tx: Database,
    productId: string,
  ): Promise<{ recipeId: string; yieldQty: number; lines: BomLine[] } | undefined> {
    const recipes = await tx
      .select()
      .from(recipe)
      .where(eq(recipe.productId, productId))
      .limit(1);

    const head = recipes[0];
    if (head === undefined) {
      return undefined;
    }

    const lines = await tx
      .select({
        ingredientId: recipeItem.ingredientId,
        qty: recipeItem.qty,
        unit: recipeItem.unit,
        ingredientName: ingredient.name,
        costPerUnit: ingredient.costPerUnit,
      })
      .from(recipeItem)
      .innerJoin(ingredient, eq(ingredient.id, recipeItem.ingredientId))
      .where(eq(recipeItem.recipeId, head.id));

    return {
      recipeId: head.id,
      yieldQty: Number(head.yieldQty),
      lines: lines.map((line) => ({
        ingredientId: line.ingredientId,
        ingredientName: line.ingredientName,
        unit: line.unit,
        qtyPerUnit: Number(line.qty),
        costPerUnit: line.costPerUnit,
      })),
    };
  }

  async getStock(tx: Database, outletId: string, ingredientId: string): Promise<number> {
    const rows = await tx
      .select({ qtyOnHand: stockLevel.qtyOnHand })
      .from(stockLevel)
      .where(and(eq(stockLevel.outletId, outletId), eq(stockLevel.ingredientId, ingredientId)))
      .limit(1);
    return Number(rows[0]?.qtyOnHand ?? 0);
  }

  async upsertStock(
    tx: Database,
    outletId: string,
    ingredientId: string,
    delta: number,
  ): Promise<number> {
    const rows = await tx
      .insert(stockLevel)
      .values({
        outletId,
        ingredientId,
        qtyOnHand: String(delta),
      })
      .onConflictDoUpdate({
        target: [stockLevel.outletId, stockLevel.ingredientId],
        set: {
          qtyOnHand: sql`${stockLevel.qtyOnHand} + ${delta}`,
          updatedAt: new Date(),
        },
      })
      .returning({ qtyOnHand: stockLevel.qtyOnHand });

    return Number(rows[0]?.qtyOnHand ?? 0);
  }

  async recordMovement(
    tx: Database,
    values: typeof stockMovement.$inferInsert,
  ): Promise<void> {
    await tx.insert(stockMovement).values(values);
  }

  async upsertReservation(
    tx: Database,
    values: typeof stockReservation.$inferInsert,
  ): Promise<void> {
    await tx
      .insert(stockReservation)
      .values(values)
      .onConflictDoUpdate({
        target: [stockReservation.orderId, stockReservation.ingredientId],
        set: { qty: values.qty, status: 'ACTIVE', updatedAt: new Date() },
      });
  }

  async releaseReservations(tx: Database, orderId: string): Promise<void> {
    await tx
      .update(stockReservation)
      .set({ status: 'RELEASED', updatedAt: new Date() })
      .where(eq(stockReservation.orderId, orderId));
  }

  async listLowStock(
    outletId: string,
    threshold: number,
  ): Promise<
    { ingredientId: string; ingredientName: string; qtyOnHand: number; unit: string; threshold: number }[]
  > {
    const rows = await this.db
      .select({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        qtyOnHand: stockLevel.qtyOnHand,
        threshold: stockLevel.lowStockThreshold,
      })
      .from(stockLevel)
      .innerJoin(ingredient, eq(ingredient.id, stockLevel.ingredientId))
      .where(and(eq(stockLevel.outletId, outletId), sql`${stockLevel.qtyOnHand} <= ${threshold}`));

    return rows.map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.ingredientName,
      unit: row.unit,
      qtyOnHand: Number(row.qtyOnHand),
      threshold,
    }));
  }

  async listIngredientsWithStock(
    outletId: string,
  ): Promise<{ ingredientId: string; name: string; unit: string; qtyOnHand: number }[]> {
    const rows = await this.db
      .select({
        ingredientId: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        qtyOnHand: stockLevel.qtyOnHand,
      })
      .from(ingredient)
      .leftJoin(
        stockLevel,
        and(eq(stockLevel.ingredientId, ingredient.id), eq(stockLevel.outletId, outletId)),
      )
      .where(and(eq(ingredient.outletId, outletId), eq(ingredient.isActive, true)));

    return rows.map((row) => ({
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      qtyOnHand: Number(row.qtyOnHand ?? 0),
    }));
  }
}
