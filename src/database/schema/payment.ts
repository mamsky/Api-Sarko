import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Pembayaran, refund, dan log webhook (PRD §7.9, §9.1).
 *
 * `payment.gateway_reference` UNIQUE = kunci idempotensi webhook:
 * kirim 10× tetap 1 efek. `payment_webhook_log` append-only untuk forensik.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);

export const payment = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderId: uuid('order_id').notNull(),
    method: varchar('method', { length: 16 }).notNull(),
    amount: money('amount'),
    status: varchar('status', { length: 24 }).notNull().default('PENDING'),
    gatewayReference: varchar('gateway_reference', { length: 128 }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    gatewayPayload: jsonb('gateway_payload'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    gatewayReferenceUnique: uniqueIndex('payment_gateway_reference_uq').on(table.gatewayReference),
    idempotencyKeyUnique: uniqueIndex('payment_idempotency_key_uq').on(table.idempotencyKey),
    orderIdx: index('payment_order_idx').on(table.orderId),
    outletCreatedIdx: index('payment_outlet_created_idx').on(table.outletId, table.createdAt),
    outletStatusIdx: index('payment_outlet_status_idx').on(table.outletId, table.status),
  }),
);

export const refund = pgTable(
  'refund',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    paymentId: uuid('payment_id').notNull(),
    orderId: uuid('order_id').notNull(),
    amount: money('amount'),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('REQUESTED'),
    requestedBy: uuid('requested_by'),
    approvedBy: uuid('approved_by'),
    gatewayReference: varchar('gateway_reference', { length: 128 }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    paymentIdx: index('refund_payment_idx').on(table.paymentId),
    orderIdx: index('refund_order_idx').on(table.orderId),
    outletCreatedIdx: index('refund_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

/** Append-only: setiap webhook mentah dicatat sebelum diproses. */
export const paymentWebhookLog = pgTable(
  'payment_webhook_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id'),
    gatewayReference: varchar('gateway_reference', { length: 128 }),
    event: varchar('event', { length: 32 }).notNull(),
    signatureValid: varchar('signature_valid', { length: 8 }).notNull().default('true'),
    rawBody: text('raw_body').notNull(),
    payload: jsonb('payload'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    gatewayReferenceIdx: index('payment_webhook_log_ref_idx').on(table.gatewayReference),
    createdAtIdx: index('payment_webhook_log_created_idx').on(table.createdAt),
  }),
);

export const settlement = pgTable(
  'settlement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    businessDate: varchar('business_date', { length: 10 }).notNull(),
    systemTotal: money('system_total'),
    gatewayTotal: money('gateway_total'),
    cashTotal: money('cash_total'),
    variance: money('variance'),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletDateUnique: uniqueIndex('settlement_outlet_date_uq').on(
      table.outletId,
      table.businessDate,
    ),
    outletCreatedIdx: index('settlement_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);
