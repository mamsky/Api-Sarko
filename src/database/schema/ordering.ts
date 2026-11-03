import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Pesanan (PRD §7.4, §9.1, §9.2b).
 *
 * `order.id` dibuat di perangkat (UUID v4) dan cloud menerimanya apa adanya.
 * `client_order_id` = `command_id` perintah CREATE_ORDER, UNIQUE, jaring pengaman retry.
 * `order_no` final sejak dibuat, dari blok nomor — UNIQUE per outlet.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);

export const diningTable = pgTable(
  'dining_table',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    label: varchar('label', { length: 50 }).notNull(),
    area: varchar('area', { length: 50 }),
    seats: integer('seats').notNull().default(2),
    qrToken: varchar('qr_token', { length: 64 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletLabelUnique: uniqueIndex('dining_table_outlet_label_uq').on(table.outletId, table.label),
    qrTokenUnique: uniqueIndex('dining_table_qr_token_uq').on(table.qrToken),
  }),
);

export const shift = pgTable(
  'shift',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: uuid('device_id'),
    openedByUserId: uuid('opened_by_user_id').notNull(),
    closedByUserId: uuid('closed_by_user_id'),
    status: varchar('status', { length: 16 }).notNull().default('OPEN'),
    openingCash: money('opening_cash'),
    closingCash: money('closing_cash'),
    expectedCash: money('expected_cash'),
    variance: money('variance'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletStatusIdx: index('shift_outlet_status_idx').on(table.outletId, table.status),
    outletCreatedIdx: index('shift_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

/**
 * Blok nomor order (PRD §9.2b). Alokasi memakai `SELECT ... FOR UPDATE`
 * pada `(outlet_id, prefix)` agar rentang tidak pernah tumpang tindih.
 */
export const numberBlock = pgTable(
  'number_block',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: uuid('device_id'),
    shiftId: uuid('shift_id'),
    prefix: varchar('prefix', { length: 32 }).notNull(),
    rangeStart: bigint('range_start', { mode: 'number' }).notNull(),
    rangeEnd: bigint('range_end', { mode: 'number' }).notNull(),
    nextValue: bigint('next_value', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }).notNull().defaultNow(),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletPrefixDeviceUnique: uniqueIndex('number_block_outlet_prefix_device_uq').on(
      table.outletId,
      table.prefix,
      table.deviceId,
    ),
    outletPrefixIdx: index('number_block_outlet_prefix_idx').on(table.outletId, table.prefix),
  }),
);

export const order = pgTable(
  'order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderNo: varchar('order_no', { length: 48 }).notNull(),
    clientOrderId: varchar('client_order_id', { length: 64 }),
    shiftId: uuid('shift_id'),
    deviceId: uuid('device_id'),
    userId: uuid('user_id'),
    customerId: uuid('customer_id'),
    tableId: uuid('table_id'),
    tableLabel: varchar('table_label', { length: 50 }),
    channel: varchar('channel', { length: 16 }).notNull(),
    fulfillment: varchar('fulfillment', { length: 16 }).notNull(),
    status: varchar('status', { length: 24 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 16 }).notNull(),
    subtotal: money('subtotal'),
    discount: money('discount'),
    serviceCharge: money('service_charge'),
    tax: money('tax'),
    roundingAdjustment: money('rounding_adjustment'),
    total: money('total'),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    cashReceived: bigint('cash_received', { mode: 'number' }),
    changeDue: bigint('change_due', { mode: 'number' }),
    discountCode: varchar('discount_code', { length: 50 }),
    notes: text('notes'),
    businessDate: varchar('business_date', { length: 10 }).notNull(),
    clockSkewMs: integer('clock_skew_ms'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletOrderNoUnique: uniqueIndex('order_outlet_order_no_uq').on(table.outletId, table.orderNo),
    clientOrderIdUnique: uniqueIndex('order_client_order_id_uq').on(table.clientOrderId),
    outletCreatedIdx: index('order_outlet_created_idx').on(table.outletId, table.createdAt),
    outletStatusIdx: index('order_outlet_status_idx').on(table.outletId, table.status),
    outletBusinessDateIdx: index('order_outlet_business_date_idx').on(
      table.outletId,
      table.businessDate,
    ),
    statusCreatedIdx: index('order_status_created_idx').on(table.status, table.createdAt),
  }),
);

export const orderItem = pgTable(
  'order_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 120 }).notNull(),
    sku: varchar('sku', { length: 48 }),
    qty: integer('qty').notNull(),
    unitPrice: money('unit_price'),
    modifierTotal: money('modifier_total'),
    subtotal: money('subtotal'),
    station: varchar('station', { length: 16 }).notNull().default('KOPI'),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    notes: varchar('notes', { length: 200 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    orderIdx: index('order_item_order_idx').on(table.orderId),
    outletCreatedIdx: index('order_item_outlet_created_idx').on(table.outletId, table.createdAt),
    stationStatusIdx: index('order_item_station_status_idx').on(table.station, table.status),
  }),
);

export const orderItemModifier = pgTable(
  'order_item_modifier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderItemId: uuid('order_item_id').notNull(),
    modifierOptionId: uuid('modifier_option_id').notNull(),
    modifierGroupName: varchar('modifier_group_name', { length: 80 }),
    name: varchar('name', { length: 80 }).notNull(),
    priceDelta: money('price_delta'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    itemIdx: index('order_item_modifier_item_idx').on(table.orderItemId),
    outletCreatedIdx: index('order_item_modifier_outlet_created_idx').on(
      table.outletId,
      table.createdAt,
    ),
  }),
);

/** Append-only audit transisi status (PRD §7.4.2). */
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    orderId: uuid('order_id').notNull(),
    fromStatus: varchar('from_status', { length: 24 }),
    toStatus: varchar('to_status', { length: 24 }).notNull(),
    actorId: uuid('actor_id'),
    deviceId: uuid('device_id'),
    reason: text('reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    orderCreatedIdx: index('order_status_history_order_created_idx').on(
      table.orderId,
      table.createdAt,
    ),
    outletCreatedIdx: index('order_status_history_outlet_created_idx').on(
      table.outletId,
      table.createdAt,
    ),
  }),
);

export const cashDrop = pgTable(
  'cash_drop',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    shiftId: uuid('shift_id').notNull(),
    amount: money('amount'),
    denominationBreakdown: jsonb('denomination_breakdown'),
    note: text('note'),
    actorId: uuid('actor_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    outletCreatedIdx: index('cash_drop_outlet_created_idx').on(table.outletId, table.createdAt),
    shiftIdx: index('cash_drop_shift_idx').on(table.shiftId),
  }),
);
