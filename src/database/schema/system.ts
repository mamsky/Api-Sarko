import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Sistem: outbox, audit, idempotency, tax (PRD §7.11, §9.1).
 *
 * `outbox_event` ditulis dalam transaksi yang sama dengan perubahan data
 * (AD-04) — relay worker yang mem-publish, bukan service.
 * `audit_log`, `idempotency_key` append-only/immutable.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const outboxEvent = pgTable(
  'outbox_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id'),
    aggregateType: varchar('aggregate_type', { length: 32 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    statusAvailableIdx: index('outbox_event_status_available_idx').on(
      table.status,
      table.availableAt,
    ),
    aggregateIdx: index('outbox_event_aggregate_idx').on(table.aggregateType, table.aggregateId),
    outletCreatedIdx: index('outbox_event_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id'),
    actorId: uuid('actor_id'),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    entityId: varchar('entity_id', { length: 128 }).notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    ipAddress: varchar('ip_address', { length: 64 }),
    traceId: varchar('trace_id', { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    entityIdx: index('audit_log_entity_idx').on(table.entityType, table.entityId),
    actorCreatedIdx: index('audit_log_actor_created_idx').on(table.actorId, table.createdAt),
    outletCreatedIdx: index('audit_log_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

/**
 * Idempotency (PRD FR-PAY-01). `key` UNIQUE per aktor; `request_hash`
 * menentukan apakah request ulang identik (replay) atau berbeda (409).
 */
export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 128 }).notNull(),
    actorId: varchar('actor_id', { length: 128 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body'),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    keyActorUnique: uniqueIndex('idempotency_key_key_actor_uq').on(table.key, table.actorId),
    expiresIdx: index('idempotency_key_expires_idx').on(table.expiresAt),
  }),
);

export const taxConfig = pgTable(
  'tax_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    rateBps: integer('rate_bps').notNull().default(1000),
    serviceChargeBps: integer('service_charge_bps').notNull().default(0),
    isInclusive: varchar('is_inclusive', { length: 8 }).notNull().default('false'),
    isActive: varchar('is_active', { length: 8 }).notNull().default('true'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletNameUnique: uniqueIndex('tax_config_outlet_name_uq').on(table.outletId, table.name),
  }),
);

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id'),
    channel: varchar('channel', { length: 16 }).notNull(),
    template: varchar('template', { length: 64 }).notNull(),
    recipient: varchar('recipient', { length: 160 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    payload: jsonb('payload'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    statusCreatedIdx: index('notification_log_status_created_idx').on(
      table.status,
      table.createdAt,
    ),
    outletCreatedIdx: index('notification_log_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const businessDateRecord = pgTable(
  'business_date',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    businessDate: varchar('business_date', { length: 10 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('OPEN'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    totalSales: bigint('total_sales', { mode: 'number' }).notNull().default(0),
    totalOrders: integer('total_orders').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletDateUnique: uniqueIndex('business_date_outlet_date_uq').on(
      table.outletId,
      table.businessDate,
    ),
  }),
);
