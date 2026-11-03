import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';
import { productAvailabilitySchema, productSchema } from '../catalog/product.schema.js';
import { orderSchema } from '../ordering/order.schema.js';

export const syncPullQuerySchema = z.object({
  since: z.string().datetime().describe('Cursor waktu/event terakhir yang sudah diterima device'),
  outlet_id: uuidSchema,
  device_id: z.string().min(1),
});
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;

/**
 * Konfigurasi pajak dalam basis points (bps).
 * 1000 bps = 10%. Pajak di SARKO adalah persentase, BUKAN nominal flat (PRD B5) —
 * menyimpan bps menghindari float dan memudahkan perubahan tarif tanpa migrasi.
 */
export const taxConfigSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  rate_bps: z.number().int().nonnegative().describe('Tarif pajak dalam basis points (1000 = 10%)'),
});
export type TaxConfig = z.infer<typeof taxConfigSchema>;

export const syncPullChangesSchema = z.object({
  products: z.array(productSchema).default([]),
  availability: z.array(productAvailabilitySchema).default([]),
  promotion: z.array(z.unknown()).default([]).describe('Promo masih generik — akan diperketat saat modul promo siap'),
  tax_config: z.array(taxConfigSchema).default([]),
  orders: z.array(orderSchema).default([]),
});
export type SyncPullChanges = z.infer<typeof syncPullChangesSchema>;

export const syncPullResponseSchema = z.object({
  server_time: z.string().datetime(),
  next_event_id: z.string().describe('Cursor untuk pull berikutnya'),
  has_more: z.boolean().describe('true bila masih ada halaman berikutnya — device harus pull lagi'),
  menu_version: z.string().describe('Versi menu, berubah bila katalog berubah'),
  clock_skew_ms: z.number().int().describe('server_time - device time, untuk koreksi jam device'),
  changes: syncPullChangesSchema,
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
