import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Promosi & voucher (PRD FR-ADM-04).
 * Diskon disimpan sebagai bps ATAU nominal — validasi dilakukan server,
 * tidak pernah mempercayai diskon dari client.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);

export const promotion = pgTable(
  'promotion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    discountType: varchar('discount_type', { length: 16 }).notNull().default('PERCENT'),
    discountBps: integer('discount_bps').notNull().default(0),
    discountAmount: money('discount_amount'),
    maxDiscount: money('max_discount'),
    minPurchase: money('min_purchase'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    stackingRule: varchar('stacking_rule', { length: 16 }).notNull().default('EXCLUSIVE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCodeUnique: uniqueIndex('promotion_outlet_code_uq').on(table.outletId, table.code),
    outletActiveIdx: index('promotion_outlet_active_idx').on(table.outletId, table.isActive),
  }),
);

export const voucher = pgTable(
  'voucher',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    promotionId: uuid('promotion_id'),
    code: varchar('code', { length: 50 }).notNull(),
    maxRedemptions: integer('max_redemptions').notNull().default(0),
    redemptionCount: integer('redemption_count').notNull().default(0),
    maxPerCustomer: integer('max_per_customer').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCodeUnique: uniqueIndex('voucher_outlet_code_uq').on(table.outletId, table.code),
    outletCreatedIdx: index('voucher_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const voucherRedemption = pgTable(
  'voucher_redemption',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    voucherId: uuid('voucher_id').notNull(),
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id'),
    discountAmount: money('discount_amount'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    voucherOrderUnique: uniqueIndex('voucher_redemption_voucher_order_uq').on(
      table.voucherId,
      table.orderId,
    ),
    outletCreatedIdx: index('voucher_redemption_outlet_created_idx').on(
      table.outletId,
      table.createdAt,
    ),
  }),
);
