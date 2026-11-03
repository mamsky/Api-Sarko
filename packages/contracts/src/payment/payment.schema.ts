import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';
import { positiveRupiahSchema, rupiahSchema } from '../common/money.js';
import { paymentMethodSchema } from '../ordering/create-order.schema.js';

export const paymentStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * `idempotency_key` WAJIB: payment gateway bisa retry, dan double-charge
 * adalah kegagalan yang tidak bisa dimaafkan.
 */
export const createPaymentSchema = z.object({
  order_id: uuidSchema,
  method: paymentMethodSchema,
  amount: positiveRupiahSchema,
  idempotency_key: z.string().min(1).max(128),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const paymentSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  method: paymentMethodSchema,
  amount: rupiahSchema,
  status: paymentStatusSchema,
  gateway_reference: z.string().nullable(),
  paid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const refundSchema = z.object({
  payment_id: uuidSchema,
  amount: positiveRupiahSchema,
  reason: z.string().min(5).max(500),
});
export type RefundInput = z.infer<typeof refundSchema>;

export const webhookEventSchema = z.enum([
  'payment.paid',
  'payment.failed',
  'payment.expired',
  'refund.succeeded',
]);
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookPayloadSchema = z.object({
  event: webhookEventSchema,
  reference: z.string().min(1),
  order_id: uuidSchema,
  amount: rupiahSchema,
  paid_at: z.string().datetime(),
  signature: z.string().min(1).describe('HMAC signature — diverifikasi sebelum diproses'),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
