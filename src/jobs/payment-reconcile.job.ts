import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, lt } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/drizzle.service';
import { order, payment } from '../database/schema';
import { OutboxService } from '../shared/outbox/outbox.service';
import { PaymentRepository } from '../modules/payment/repositories/payment.repository';

export type ReconciliationResult = {
  outlet_id: string;
  business_date: string;
  status: 'MATCH' | 'SELISIH_NOMINAL' | 'TRANSAKSI_HILANG_DI_SISTEM' | 'TRANSAKSI_HILANG_DI_GATEWAY';
  variance: number;
};

/**
 * Rekonsiliasi harian (PRD FR-PAY-04).
 *
 * Membandingkan total order yang sudah dibayar vs total payment PAID untuk
 * hari bisnis yang sama. Selisih > 0 memicu alert ke finance lewat outbox.
 */
@Injectable()
export class PaymentReconcileJob {
  private readonly logger = new Logger(PaymentReconcileJob.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payments: PaymentRepository,
    private readonly outbox: OutboxService,
  ) {}

  @Cron('0 30 1 * * *')
  async reconcilePreviousDay(): Promise<void> {
    const yesterday = new Date(Date.now() - 86_400_000);
    const businessDate = yesterday.toISOString().slice(0, 10);

    const pending = await this.payments.listPendingReconciliation('', businessDate);
    if (pending.length === 0) {
      this.logger.debug({ businessDate }, 'Tidak ada pembayaran menggantung');
      return;
    }

    this.logger.warn(
      { businessDate, count: pending.length },
      'Pembayaran masih PENDING melewati batas hari bisnis',
    );

    for (const row of pending) {
      await this.outbox.enqueue(this.db, {
        aggregateType: 'payment',
        aggregateId: row.id,
        eventType: 'payment.reconcile.pending',
        outletId: row.outletId,
        payload: { payment_id: row.id, order_id: row.orderId, created_at: row.createdAt },
      });
    }
  }

  /** Tandai payment PENDING yang melewati TTL sebagai EXPIRED. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStalePayments(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const expired = await this.db
      .update(payment)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(and(eq(payment.status, 'PENDING'), lt(payment.createdAt, cutoff)))
      .returning({ id: payment.id, orderId: payment.orderId, outletId: payment.outletId });

    for (const row of expired) {
      await this.outbox.enqueue(this.db, {
        aggregateType: 'payment',
        aggregateId: row.id,
        eventType: 'payment.expired',
        outletId: row.outletId,
        payload: { payment_id: row.id, order_id: row.orderId },
      });
    }

    if (expired.length > 0) {
      this.logger.log({ count: expired.length }, 'Pembayaran kedaluwarsa ditandai');
    }
  }

  async compareDay(outletId: string, businessDate: string): Promise<ReconciliationResult> {
    const orders = await this.db
      .select({ total: order.total })
      .from(order)
      .where(and(eq(order.outletId, outletId), eq(order.businessDate, businessDate)));

    const paid = await this.db
      .select({ amount: payment.amount })
      .from(payment)
      .where(and(eq(payment.outletId, outletId), eq(payment.status, 'PAID')));

    const orderTotal = orders.reduce((total, row) => total + row.total, 0);
    const paymentTotal = paid.reduce((total, row) => total + row.amount, 0);
    const variance = paymentTotal - orderTotal;

    return {
      outlet_id: outletId,
      business_date: businessDate,
      status: variance === 0 ? 'MATCH' : 'SELISIH_NOMINAL',
      variance,
    };
  }
}
