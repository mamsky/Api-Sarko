import { bigint, boolean, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Inventaris & BOM (PRD §9.1, FR-INV).
 * `stock_movement` bersifat append-only — stok adalah hasil penjumlahan movement,
 * bukan angka yang di-update sembarangan.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

/** Qty bahan bisa pecahan gram/ml — `numeric` dengan presisi tetap, bukan float. */
const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });

export const ingredient = pgTable(
  'ingredient',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    sku: varchar('sku', { length: 48 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull().default('GRAM'),
    costPerUnit: bigint('cost_per_unit', { mode: 'number' }).notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    outletSkuUnique: uniqueIndex('ingredient_outlet_sku_uq').on(table.outletId, table.sku),
    outletCreatedIdx: index('ingredient_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const recipe = pgTable(
  'recipe',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    productId: uuid('product_id').notNull(),
    yieldQty: numeric('yield_qty', { precision: 10, scale: 3 }).notNull().default('1'),
    hpp: bigint('hpp', { mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    productUnique: uniqueIndex('recipe_product_uq').on(table.productId),
    outletCreatedIdx: index('recipe_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const recipeItem = pgTable(
  'recipe_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    qty: qty('qty').notNull(),
    unit: varchar('unit', { length: 16 }).notNull().default('GRAM'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    recipeIngredientUnique: uniqueIndex('recipe_item_uq').on(table.recipeId, table.ingredientId),
  }),
);

export const stockLevel = pgTable(
  'stock_level',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    qtyOnHand: qty('qty_on_hand').notNull().default('0'),
    qtyReserved: qty('qty_reserved').notNull().default('0'),
    lowStockThreshold: qty('low_stock_threshold').notNull().default('0'),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (table) => ({
    outletIngredientUnique: uniqueIndex('stock_level_outlet_ingredient_uq').on(
      table.outletId,
      table.ingredientId,
    ),
  }),
);

/**
 * Append-only. `qty_delta` negatif = pemakaian, positif = penerimaan.
 * Stok boleh negatif (PRD: lebih baik jualan jalan daripada blokir kasir) —
 * nilai negatif menjadi sinyal untuk stock opname.
 */
export const stockMovement = pgTable(
  'stock_movement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    orderId: uuid('order_id'),
    type: varchar('type', { length: 32 }).notNull(),
    qtyDelta: qty('qty_delta').notNull(),
    qtyAfter: qty('qty_after'),
    reference: varchar('reference', { length: 128 }),
    note: text('note'),
    actorId: uuid('actor_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCreatedIdx: index('stock_movement_outlet_created_idx').on(table.outletId, table.createdAt),
    ingredientCreatedIdx: index('stock_movement_ingredient_created_idx').on(
      table.ingredientId,
      table.createdAt,
    ),
    orderIdx: index('stock_movement_order_idx').on(table.orderId),
  }),
);

export const stockReservation = pgTable(
  'stock_reservation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderId: uuid('order_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    qty: qty('qty').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    orderIngredientUnique: uniqueIndex('stock_reservation_order_ingredient_uq').on(
      table.orderId,
      table.ingredientId,
    ),
    outletStatusIdx: index('stock_reservation_outlet_status_idx').on(table.outletId, table.status),
  }),
);
