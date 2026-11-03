import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Katalog: kategori, produk, modifier group/option (PRD §9.1).
 * Harga = bigint integer rupiah. `modifier_group` bersifat master (boleh tanpa outlet).
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    outletNameUnique: uniqueIndex('category_outlet_name_uq').on(table.outletId, table.name),
    outletCreatedIdx: index('category_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const product = pgTable(
  'product',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    sku: varchar('sku', { length: 48 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    basePrice: bigint('base_price', { mode: 'number' }).notNull(),
    imageUrl: text('image_url'),
    station: varchar('station', { length: 16 }).notNull().default('KOPI'),
    isAvailable: boolean('is_available').notNull().default(true),
    prepTimeMinutes: integer('prep_time_minutes').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    outletSkuUnique: uniqueIndex('product_outlet_sku_uq').on(table.outletId, table.sku),
    outletCategoryIdx: index('product_outlet_category_idx').on(table.outletId, table.categoryId),
    outletCreatedIdx: index('product_outlet_created_idx').on(table.outletId, table.createdAt),  }),
);

export const modifierGroup = pgTable(
  'modifier_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id'),
    name: varchar('name', { length: 80 }).notNull(),
    selectionType: varchar('selection_type', { length: 16 }).notNull().default('SINGLE'),
    isRequired: boolean('is_required').notNull().default(false),
    minSelect: integer('min_select').notNull().default(0),
    maxSelect: integer('max_select').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    outletNameUnique: uniqueIndex('modifier_group_outlet_name_uq').on(table.outletId, table.name),
  }),
);

export const modifierOption = pgTable(
  'modifier_option',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modifierGroupId: uuid('modifier_group_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    priceDelta: bigint('price_delta', { mode: 'number' }).notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    groupNameUnique: uniqueIndex('modifier_option_group_name_uq').on(
      table.modifierGroupId,
      table.name,
    ),
  }),
);

export const productModifierGroup = pgTable(
  'product_modifier_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull(),
    modifierGroupId: uuid('modifier_group_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    productGroupUnique: uniqueIndex('product_modifier_group_uq').on(
      table.productId,
      table.modifierGroupId,
    ),
  }),
);
