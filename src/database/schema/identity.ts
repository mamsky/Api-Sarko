import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Identitas & organisasi (PRD §9.1).
 *
 * Uang: `bigint({ mode: 'number' })` — integer rupiah penuh, tidak ada desimal.
 * Semua tabel transaksional membawa `outlet_id` + `created_at` + `updated_at`.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

export const outlet = pgTable(
  'outlet',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 16 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    address: text('address'),
    phone: varchar('phone', { length: 32 }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Jakarta'),
    cutoffHour: integer('cutoff_hour').notNull().default(4),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    codeUnique: uniqueIndex('outlet_code_uq').on(table.code),
  }),
);

export const role = pgTable(
  'role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    codeUnique: uniqueIndex('role_code_uq').on(table.code),
  }),
);

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 160 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    passwordHash: text('password_hash').notNull(),
    pinHash: text('pin_hash'),
    roleCode: varchar('role_code', { length: 32 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => ({
    emailUnique: uniqueIndex('user_email_uq').on(table.email),
    roleIdx: index('user_role_idx').on(table.roleCode),
  }),
);

export const userOutlet = pgTable(
  'user_outlet',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    userOutletUnique: uniqueIndex('user_outlet_uq').on(table.userId, table.outletId),
    outletIdx: index('user_outlet_outlet_idx').on(table.outletId),
  }),
);

export const device = pgTable(
  'device',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    deviceName: varchar('device_name', { length: 100 }).notNull(),
    deviceType: varchar('device_type', { length: 16 }).notNull(),
    platform: varchar('platform', { length: 16 }).notNull(),
    appVersion: varchar('app_version', { length: 32 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    deviceIdUnique: uniqueIndex('device_device_id_uq').on(table.deviceId),
    outletStatusIdx: index('device_outlet_status_idx').on(table.outletId, table.status),
  }),
);

export const deviceHeartbeat = pgTable(
  'device_heartbeat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
    appVersion: varchar('app_version', { length: 32 }),
    queueDepth: integer('queue_depth').notNull().default(0),
    clockSkewMs: bigint('clock_skew_ms', { mode: 'number' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    deviceSeenIdx: index('device_heartbeat_device_seen_idx').on(table.deviceId, table.seenAt),
    outletCreatedIdx: index('device_heartbeat_outlet_created_idx').on(table.outletId, table.createdAt),
  }),
);

export const refreshToken = pgTable(
  'refresh_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    deviceId: uuid('device_id'),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('refresh_token_hash_uq').on(table.tokenHash),
    userIdx: index('refresh_token_user_idx').on(table.userId),
  }),
);

/** Append-only: setiap percobaan PIN dicatat untuk audit lockout (FR-AUTH). */
export const pinAttempt = pgTable(
  'pin_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    deviceId: uuid('device_id'),
    success: boolean('success').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    userCreatedIdx: index('pin_attempt_user_created_idx').on(table.userId, table.createdAt),
  }),
);

export const systemSetting = pgTable(
  'system_setting',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 96 }).notNull(),
    value: jsonb('value').notNull(),
    description: text('description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    keyUnique: uniqueIndex('system_setting_key_uq').on(table.key),
  }),
);
