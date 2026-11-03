import { z } from 'zod';

import { ulidSchema, uuidSchema } from '../common/identifiers.js';
import { rupiahSchema } from '../common/money.js';

/** Perintah offline yang bisa dikirim device ke server (PRD §10.1.3). */
export const syncCommandTypeSchema = z.enum([
  'CREATE_ORDER',
  'VOID_BEFORE_PAY',
  'UPDATE_ITEM_STATUS',
  'HOLD_ITEM',
  'RESUME_ITEM',
  'OPEN_SHIFT',
  'CLOSE_SHIFT',
  'CASH_DROP',
  'PRINT_REPRINT',
  'APPLY_DISCOUNT',
  'VOID_AFTER_PAY',
  'REFUND',
  'UPDATE_PRODUCT',
]);
export type SyncCommandType = z.infer<typeof syncCommandTypeSchema>;

export const syncCommandSchema = z.object({
  command_id: ulidSchema.describe('ULID dari device — kunci idempotensi per command'),
  type: syncCommandTypeSchema,
  aggregate_id: z.string().min(1).describe('ID entitas target, mis. order id / shift id'),
  payload: z.record(z.unknown()).describe('Body spesifik per tipe command'),
  depends_on: z.string().nullable().optional().describe('command_id lain yang harus sukses lebih dulu'),
  created_at: z.string().datetime().describe('Waktu device membuat command'),
});
export type SyncCommand = z.infer<typeof syncCommandSchema>;

export const syncPushRequestSchema = z.object({
  device_id: z.string().min(1),
  outlet_id: uuidSchema,
  app_version: z.string().min(1),
  offline_since: z.string().datetime().nullable().optional(),
  commands: z.array(syncCommandSchema).min(1).max(50).describe('Batch maksimal 50 command per push'),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncCommandStatusSchema = z.enum(['CREATED', 'DUPLICATE', 'UPDATED', 'REJECTED', 'RETRY']);
export type SyncCommandStatus = z.infer<typeof syncCommandStatusSchema>;

export const syncWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  client_total: rupiahSchema.optional(),
  server_total: rupiahSchema.optional(),
});
export type SyncWarning = z.infer<typeof syncWarningSchema>;

export const syncCommandResultSchema = z.object({
  command_id: z.string(),
  status: syncCommandStatusSchema,
  aggregate_id: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  warnings: z.array(syncWarningSchema).default([]),
});
export type SyncCommandResult = z.infer<typeof syncCommandResultSchema>;

export const syncPushResponseSchema = z.object({
  server_time: z.string().datetime(),
  results: z.array(syncCommandResultSchema),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
