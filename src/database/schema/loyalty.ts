import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Loyalty (PRD FR-APP-07). `loyalty_ledger` append-only —
 * reversal refund menulis entri negatif, TIDAK PERNAH menghapus baris.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const loyaltyAccount = pgTable(
  'loyalty_account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    pointsBalance: integer('points_balance').notNull().default(0),
    lifetimePoints: integer('lifetime_points').notNull().default(0),
    tier: varchar('tier', { length: 16 }).notNull().default('BRONZE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCustomerUnique: uniqueIndex('loyalty_account_outlet_customer_uq').on(
      table.outletId,
      table.customerId,
    ),
    outletCreatedIdx: index('loyalty_account_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const loyaltyLedger = pgTable(
  'loyalty_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    accountId: uuid('account_id').notNull(),
    orderId: uuid('order_id'),
    type: varchar('type', { length: 32 }).notNull(),
    pointsDelta: integer('points_delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    reference: varchar('reference', { length: 128 }),
    note: text('note'),
    actorId: uuid('actor_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    accountCreatedIdx: index('loyalty_ledger_account_created_idx').on(
      table.accountId,
      table.createdAt,
    ),
    orderIdx: index('loyalty_ledger_order_idx').on(table.orderId),
    outletCreatedIdx: index('loyalty_ledger_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const loyaltyTier = pgTable(
  'loyalty_tier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    code: varchar('code', { length: 16 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    minLifetimePoints: integer('min_lifetime_points').notNull().default(0),
    multiplierBps: bigint('multiplier_bps', { mode: 'number' }).notNull().default(10_000),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCodeUnique: uniqueIndex('loyalty_tier_outlet_code_uq').on(table.outletId, table.code),
  }),
);
