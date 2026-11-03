import { z } from 'zod';

import { businessDateSchema, isoDateTimeSchema, ulidSchema, uuidSchema } from '../common/identifiers.js';
import { positiveRupiahSchema, rupiahSchema } from '../common/money.js';

/** Kanal asal order — menentukan perilaku KDS dan laporan. */
export const orderChannelSchema = z.enum(['POS', 'KDS', 'MOBILE_APP', 'QR_TABLE']);
export type OrderChannel = z.infer<typeof orderChannelSchema>;

export const fulfillmentSchema = z.enum(['DINE_IN', 'TAKE_AWAY', 'DELIVERY']);
export type Fulfillment = z.infer<typeof fulfillmentSchema>;

export const paymentMethodSchema = z.enum(['CASH', 'QRIS', 'VA', 'EWALLET', 'CARD']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Modifier yang menempel pada item — snapshot nama & harga saat order dibuat. */
export const orderItemModifierSchema = z.object({
  modifier_option_id: uuidSchema,
  name: z.string().min(1),
  price_delta: rupiahSchema.describe('Selisih harga modifier terhadap harga dasar (>= 0)'),
});
export type OrderItemModifier = z.infer<typeof orderItemModifierSchema>;

export const createOrderItemSchema = z.object({
  product_id: uuidSchema,
  qty: z.number().int().min(1).max(999),
  modifier_option_ids: z.array(uuidSchema).default([]),
  notes: z.string().max(200).optional(),
});
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;

/**
 * Payload pembuatan order. Client mengirim `client_order_id` (ULID) supaya
 * retry offline tidak menghasilkan order ganda — ini kunci idempotensi.
 */
export const createOrderSchema = z
  .object({
    client_order_id: ulidSchema.describe('ULID dari device — kunci idempotensi pembuatan order'),
    order_id: uuidSchema
      .optional()
      .describe('ID order buatan device; cloud memakainya apa adanya agar referensi lokal device tetap valid'),
    order_no: z
      .string()
      .min(1)
      .max(48)
      .optional()
      .describe('Nomor order FINAL dari device (PRD §7.12.5) — diterima apa adanya, tidak dialokasikan ulang'),
    channel: orderChannelSchema,
    fulfillment: fulfillmentSchema,
    table_id: uuidSchema.optional(),
    table_label: z.string().max(50).optional(),
    customer_id: uuidSchema.optional(),
    items: z.array(createOrderItemSchema).min(1).max(100),
    payment_method: paymentMethodSchema,
    cash_received: positiveRupiahSchema.optional().describe('WAJIB bila payment_method = CASH'),
    discount_code: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    created_at_local: isoDateTimeSchema.optional().describe('Waktu device saat order dibuat'),
    business_date: businessDateSchema.optional(),
    clock_skew_ms: z.number().int().optional().describe('Selisih jam device vs server, untuk audit'),
  })
  .refine((value) => value.payment_method !== 'CASH' || value.cash_received !== undefined, {
    message: 'cash_received wajib diisi untuk pembayaran tunai (CASH)',
    path: ['cash_received'],
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
