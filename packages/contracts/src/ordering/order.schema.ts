import { z } from 'zod';

import { businessDateSchema, uuidSchema } from '../common/identifiers.js';
import { rupiahSchema } from '../common/money.js';
import { orderChannelSchema, fulfillmentSchema, orderItemModifierSchema, paymentMethodSchema } from './create-order.schema.js';
import { orderStatusSchema } from './order-status.enum.js';

/** Stasiun produksi — menentukan layar KDS mana yang menampilkan item. */
export const stationSchema = z.enum(['KOPI', 'MAKANAN']);
export type Station = z.infer<typeof stationSchema>;

/** Status per item, independen dari status order (satu order bisa split antar stasiun). */
export const orderItemStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'HOLD']);
export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>;

export const orderItemSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  product_name: z.string(),
  qty: z.number().int(),
  unit_price: rupiahSchema,
  subtotal: rupiahSchema,
  modifiers: z.array(orderItemModifierSchema),
  notes: z.string().nullable(),
  station: stationSchema,
  status: orderItemStatusSchema,
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: uuidSchema,
  order_no: z.string().describe('Nomor order tampil ke pelanggan, contoh: SK-20250101-0001'),
  outlet_id: uuidSchema,
  channel: orderChannelSchema,
  fulfillment: fulfillmentSchema,
  table_label: z.string().nullable(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  subtotal: rupiahSchema,
  discount: rupiahSchema,
  tax: rupiahSchema,
  total: rupiahSchema,
  payment_method: paymentMethodSchema,
  paid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  synced_at: z.string().datetime().nullable().describe('null bila order masih hanya ada di device'),
  business_date: businessDateSchema,
  client_order_id: z.string().nullable(),
});
export type Order = z.infer<typeof orderSchema>;

/** Versi ringan untuk kolom Kanban — tanpa items agar payload kecil. */
export const orderSummarySchema = z.object({
  id: uuidSchema,
  order_no: z.string(),
  table_label: z.string().nullable(),
  channel: orderChannelSchema,
  fulfillment: fulfillmentSchema,
  status: orderStatusSchema,
  total: rupiahSchema,
  item_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;
