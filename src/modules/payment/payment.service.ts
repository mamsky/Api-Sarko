import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  type CreatePaymentInput,
  type OrderStatus,
  PAID_STATUSES,
  type Payment,
  type RefundInput,
  type WebhookPayload,
} from '@sarko/contracts';
import { and, eq } from 'drizzle-orm';

import type { Database } from '../../database/drizzle.service';
import { loyaltyAccount, loyaltyLedger, payment } from '../../database/schema';
import { AppError } from '../../shared/errors/app-error';
import { newId } from '../../shared/id/id';
import { subtract } from '../../shared/money/money';
import { OutboxService } from '../../shared/outbox/outbox.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStateMachine } from '../ordering/order-state.machine';
import { OrderRepository } from '../ordering/repositories/order.repository';
import { PaymentRepository } from './repositories/payment.repository';

export type WebhookContext = {
  rawBody: string;
  signature: string;
  secret: string;
  toleranceSeconds?: number;
};

export type PaymentConfig = {
  loyaltyRupiahPerPoint: number;
};

/**
 * Pembayaran (PRD §7.9).
 *
 * Tiga jaminan utama:
 * 1. Webhook diverifikasi HMAC-SHA256 dengan `timingSafeEqual` sebelum diproses.
 * 2. Webhook idempoten lewat unique `payment.gateway_reference` — 10× kirim = 1 efek.
 * 3. Nominal webhook dibandingkan dengan `order.total` di DB, bukan dipercaya.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: OrderRepository,
    private readonly inventory: InventoryService,
    private readonly outbox: OutboxService,
    @Optional()
    @Inject('PAYMENT_CONFIG')
    private readonly config: PaymentConfig = { loyaltyRupiahPerPoint: 1_000 },
  ) {}

  async create(actorId: string, dto: CreatePaymentInput): Promise<Payment> {
    const order = await this.orders.findById(dto.order_id);
    if (order === undefined) {
      throw AppError.notFound('Order');
    }
    if (OrderStateMachine.requiresPayment(order.status as OrderStatus)) {
      throw AppError.alreadyPaid();
    }
    if (dto.amount !== order.total) {
      throw AppError.totalMismatch(
        `Nominal pembayaran ${dto.amount} tidak sama dengan total order ${order.total}`,
      );
    }

    const existing = await this.payments.findByIdempotencyKey(dto.idempotency_key);
    if (existing !== undefined) {
      return toPaymentContract(existing);
    }

    const created = await this.payments.transaction(async (tx) => {
      const row = await this.payments.insert(tx, {
        id: newId(),
        outletId: order.outletId,
        orderId: order.id,
        method: dto.method,
        amount: dto.amount,
        status: 'PENDING',
        idempotencyKey: dto.idempotency_key,
      });

      await this.outbox.enqueue(tx, {
        aggregateType: 'payment',
        aggregateId: row.id,
        eventType: 'payment.created',
        outletId: order.outletId,
        payload: { payment_id: row.id, order_id: order.id, method: dto.method, amount: dto.amount, actor_id: actorId },
      });

      return row;
    });

    return toPaymentContract(created);
  }

  /**
   * Verifikasi signature webhook. `timingSafeEqual` mencegah timing attack;
   * panjang buffer disamakan dulu karena `timingSafeEqual` melempar bila beda.
   */
  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const given = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const givenBuffer = Buffer.from(given, 'utf8');
    if (expectedBuffer.length !== givenBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, givenBuffer);
  }

  async handleWebhook(payload: WebhookPayload, context: WebhookContext): Promise<{ processed: boolean }> {
    const signatureValid = this.verifySignature(context.rawBody, context.signature, context.secret);

    await this.payments.logWebhook({
      event: payload.event,
      gatewayReference: payload.reference,
      rawBody: context.rawBody,
      payload: payload as unknown as Record<string, unknown>,
      signatureValid,
    });

    if (!signatureValid) {
      throw AppError.forbidden('Signature webhook tidak valid');
    }

    if (this.isStale(payload.paid_at, context.toleranceSeconds)) {
      throw AppError.validation('Webhook kedaluwarsa di luar toleransi waktu');
    }

    const already = await this.payments.findByGatewayReference(payload.reference);
    if (already !== undefined && already.status === 'PAID') {
      this.logger.debug({ reference: payload.reference }, 'Webhook replay diabaikan');
      return { processed: false };
    }

    const order = await this.orders.findById(payload.order_id);
    if (order === undefined) {
      throw AppError.notFound('Order');
    }
    if (payload.amount !== order.total) {
      await this.payments.recordMismatch({
        outletId: order.outletId,
        orderId: order.id,
        gatewayReference: payload.reference,
        expected: order.total,
        received: payload.amount,
      });
      throw AppError.totalMismatch(
        `Nominal webhook ${payload.amount} tidak sama dengan total order ${order.total}`,
      );
    }

    await this.payments.transaction(async (tx) => {
      const target =
        already ?? (await this.payments.insert(tx, {
          id: newId(),
          outletId: order.outletId,
          orderId: order.id,
          method: 'QRIS',
          amount: payload.amount,
          status: 'PENDING',
          gatewayReference: payload.reference,
        }));

      if (payload.event === 'payment.paid') {
        await this.payments.markPaid(tx, target.id, payload.paid_at);
        await this.orders.updateStatus(tx, order.id, 'PAID', {
          paidAt: new Date(payload.paid_at),
        });
        await this.orders.recordStatusHistory(tx, {
          outletId: order.outletId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'PAID',
          actorId: null,
          deviceId: null,
          reason: 'webhook payment.paid',
        });

        await this.inventory.deduct(
          tx,
          order.id,
          order.outletId,
          order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        );

        await this.creditLoyalty(tx, order.outletId, order.id, order.customerId, order.total);

        await this.outbox.enqueue(tx, {
          aggregateType: 'order',
          aggregateId: order.id,
          eventType: 'order.paid',
          outletId: order.outletId,
          payload: {
            order_id: order.id,
            order_no: order.orderNo,
            total: order.total,
            reference: payload.reference,
          },
        });
      }

      if (payload.event === 'payment.failed' || payload.event === 'payment.expired') {
        await this.payments.markFailed(tx, target.id, payload.event === 'payment.expired' ? 'EXPIRED' : 'FAILED');
        await this.outbox.enqueue(tx, {
          aggregateType: 'payment',
          aggregateId: target.id,
          eventType: `payment.${payload.event === 'payment.expired' ? 'expired' : 'failed'}`,
          outletId: order.outletId,
          payload: { payment_id: target.id, order_id: order.id, reference: payload.reference },
        });
      }
    });

    return { processed: true };
  }

  async refund(actorId: string, dto: RefundInput): Promise<{ refund_id: string; status: string }> {
    const paymentRow = await this.payments.findById(dto.payment_id);
    if (paymentRow === undefined) {
      throw AppError.notFound('Payment');
    }

    const order = await this.orders.findById(paymentRow.orderId);
    if (order === undefined) {
      throw AppError.notFound('Order');
    }

    if (!PAID_STATUSES.includes(order.status as OrderStatus)) {
      throw AppError.conflict('Refund hanya untuk order yang sudah dibayar');
    }

    const refunded = await this.payments.sumRefunds(paymentRow.id);
    const remaining = subtract(paymentRow.amount, refunded);
    if (dto.amount > remaining) {
      throw AppError.validation('Nominal refund melebihi sisa pembayaran', [
        { field: 'amount', message: `Maksimal ${remaining}` },
      ]);
    }

    const refundId = await this.payments.transaction(async (tx) => {
      const row = await this.payments.insertRefund(tx, {
        id: newId(),
        outletId: paymentRow.outletId,
        paymentId: paymentRow.id,
        orderId: order.id,
        amount: dto.amount,
        reason: dto.reason,
        status: 'REQUESTED',
        requestedBy: actorId,
      });

      await this.reverseLoyalty(tx, order.outletId, order.id, order.customerId, dto.amount);

      await this.outbox.enqueue(tx, {
        aggregateType: 'refund',
        aggregateId: row.id,
        eventType: 'refund.requested',
        outletId: paymentRow.outletId,
        payload: {
          refund_id: row.id,
          payment_id: paymentRow.id,
          order_id: order.id,
          amount: dto.amount,
          actor_id: actorId,
        },
      });

      return row.id;
    });

    return { refund_id: refundId, status: 'REQUESTED' };
  }

  async getById(id: string): Promise<Payment> {
    const row = await this.payments.findById(id);
    if (row === undefined) {
      throw AppError.notFound('Payment');
    }
    return toPaymentContract(row);
  }

  async listByOrder(orderId: string): Promise<Payment[]> {
    const rows = await this.payments.listByOrder(orderId);
    return rows.map(toPaymentContract);
  }

  private isStale(paidAt: string, toleranceSeconds: number | undefined): boolean {
    if (toleranceSeconds === undefined || toleranceSeconds <= 0) {
      return false;
    }
    const paidTime = new Date(paidAt).getTime();
    if (Number.isNaN(paidTime)) {
      return true;
    }
    return Math.abs(Date.now() - paidTime) > toleranceSeconds * 1_000;
  }

  /**
   * Poin loyalty = floor(total / rupiahPerPoint). Ledger append-only:
   * saldo adalah hasil akumulasi entri, bukan angka yang ditimpa.
   */
  private async creditLoyalty(
    tx: Database,
    outletId: string,
    orderId: string,
    customerId: string | null,
    total: number,
  ): Promise<void> {
    if (customerId === null) {
      return;
    }

    const points = Math.floor(total / this.config.loyaltyRupiahPerPoint);
    if (points <= 0) {
      return;
    }

    const account = await this.ensureAccount(tx, outletId, customerId);
    const balanceAfter = account.pointsBalance + points;

    await tx
      .update(loyaltyAccount)
      .set({
        pointsBalance: balanceAfter,
        lifetimePoints: account.lifetimePoints + points,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccount.id, account.id));

    await tx.insert(loyaltyLedger).values({
      outletId,
      accountId: account.id,
      orderId,
      type: 'EARN',
      pointsDelta: points,
      balanceAfter,
      reference: orderId,
    });
  }

  /** Reversal refund: entri negatif, TIDAK PERNAH menghapus baris ledger. */
  private async reverseLoyalty(
    tx: Database,
    outletId: string,
    orderId: string,
    customerId: string | null,
    refundAmount: number,
  ): Promise<void> {
    if (customerId === null) {
      return;
    }

    const points = Math.floor(refundAmount / this.config.loyaltyRupiahPerPoint);
    if (points <= 0) {
      return;
    }

    const account = await this.ensureAccount(tx, outletId, customerId);
    const balanceAfter = account.pointsBalance - points;

    await tx
      .update(loyaltyAccount)
      .set({ pointsBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(loyaltyAccount.id, account.id));

    await tx.insert(loyaltyLedger).values({
      outletId,
      accountId: account.id,
      orderId,
      type: 'REVERSAL',
      pointsDelta: -points,
      balanceAfter,
      reference: orderId,
    });
  }

  private async ensureAccount(
    tx: Database,
    outletId: string,
    customerId: string,
  ): Promise<{ id: string; pointsBalance: number; lifetimePoints: number }> {
    const existing = await tx
      .select({
        id: loyaltyAccount.id,
        pointsBalance: loyaltyAccount.pointsBalance,
        lifetimePoints: loyaltyAccount.lifetimePoints,
      })
      .from(loyaltyAccount)
      .where(
        and(eq(loyaltyAccount.outletId, outletId), eq(loyaltyAccount.customerId, customerId)),
      )
      .limit(1);

    const found = existing[0];
    if (found !== undefined) {
      return found;
    }

    const inserted = await tx
      .insert(loyaltyAccount)
      .values({ outletId, customerId, pointsBalance: 0, lifetimePoints: 0 })
      .returning({
        id: loyaltyAccount.id,
        pointsBalance: loyaltyAccount.pointsBalance,
        lifetimePoints: loyaltyAccount.lifetimePoints,
      });

    const row = inserted[0];
    if (row === undefined) {
      throw AppError.internal('Gagal membuat akun loyalty');
    }
    return row;
  }
}

export function toPaymentContract(row: typeof payment.$inferSelect): Payment {
  return {
    id: row.id,
    order_id: row.orderId,
    method: row.method as Payment['method'],
    amount: row.amount,
    status: row.status as Payment['status'],
    gateway_reference: row.gatewayReference,
    paid_at: row.paidAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
