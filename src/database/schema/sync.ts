import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Sinkronisasi cloud ↔ perangkat (PRD §9.2b, §10.1.3).
 *
 * `sync_command_log.command_id` UNIQUE = kunci idempotensi per command:
 * push ulang batch yang sama tidak berefek ganda.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const syncCommandLog = pgTable(
  'sync_command_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    commandId: varchar('command_id', { length: 64 }).notNull(),
    commandType: varchar('command_type', { length: 32 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 128 }),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    result: varchar('result', { length: 16 }).notNull(),
    httpStatus: bigint('http_status', { mode: 'number' }).notNull().default(200),
    responseBody: jsonb('response_body'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    commandIdUnique: uniqueIndex('sync_command_log_command_id_uq').on(table.commandId),
    outletCreatedIdx: index('sync_command_log_outlet_created_idx').on(
      table.outletId,
      table.createdAt,
    ),
    deviceCreatedIdx: index('sync_command_log_device_created_idx').on(
      table.deviceId,
      table.createdAt,
    ),
  }),
);

export const syncConflict = pgTable(
  'sync_conflict',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    orderId: uuid('order_id'),
    type: varchar('type', { length: 32 }).notNull(),
    deviceValue: jsonb('device_value'),
    cloudValue: jsonb('cloud_value'),
    resolution: text('resolution'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletTypeIdx: index('sync_conflict_outlet_type_idx').on(table.outletId, table.type),
    orderIdx: index('sync_conflict_order_idx').on(table.orderId),
    outletCreatedIdx: index('sync_conflict_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);
