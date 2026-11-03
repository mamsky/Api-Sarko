import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import { payment, paymentWebhookLog, refund, syncConflict } from '../../../database/schema';

export type PaymentRow = typeof payment.$inferSelect;
export type RefundRow = typeof refund.$inferSelect;

@Injectable()
export class PaymentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => work(tx as unknown as Database));
  }

  async findById(id: string): Promise<PaymentRow | undefined> {
    const rows = await this.db.select().from(payment).where(eq(payment.id, id)).limit(1);
    return rows[0];
  }

  async findByIdempotencyKey(key: string): Promise<PaymentRow | undefined> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(eq(payment.idempotencyKey, key))
      .limit(1);
    return rows[0];
  }

  async findByGatewayReference(reference: string): Promise<PaymentRow | undefined> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(eq(payment.gatewayReference, reference))
      .limit(1);
    return rows[0];
  }

  async listByOrder(orderId: string): Promise<PaymentRow[]> {
    return this.db
      .select()
      .from(payment)
      .where(eq(payment.orderId, orderId))
      .orderBy(desc(payment.createdAt));
  }

  async insert(tx: Database, values: typeof payment.$inferInsert): Promise<PaymentRow> {
    const rows = await tx.insert(payment).values(values).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Insert payment tidak mengembalikan baris');
    }
    return row;
  }

  async markPaid(tx: Database, id: string, paidAt: string): Promise<void> {
    await tx
      .update(payment)
      .set({ status: 'PAID', paidAt: new Date(paidAt), updatedAt: new Date() })
      .where(eq(payment.id, id));
  }

  async markFailed(tx: Database, id: string, status: 'FAILED' | 'EXPIRED'): Promise<void> {
    await tx
      .update(payment)
      .set({ status, failedAt: new Date(), updatedAt: new Date() })
      .where(eq(payment.id, id));
  }

  async insertRefund(tx: Database, values: typeof refund.$inferInsert): Promise<RefundRow> {
    const rows = await tx.insert(refund).values(values).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Insert refund tidak mengembalikan baris');
    }
    return row;
  }

  async sumRefunds(paymentId: string): Promise<number> {
    const rows = await this.db
      .select({ total: sql<string>`coalesce(sum(${refund.amount}), 0)` })
      .from(refund)
      .where(and(eq(refund.paymentId, paymentId), eq(refund.status, 'SUCCEEDED')));
    return Number(rows[0]?.total ?? 0);
  }

  async listRefunds(orderId: string): Promise<RefundRow[]> {
    return this.db.select().from(refund).where(eq(refund.orderId, orderId));
  }

  async logWebhook(values: {
    event: string;
    gatewayReference: string;
    rawBody: string;
    payload: Record<string, unknown>;
    signatureValid: boolean;
  }): Promise<void> {
    await this.db.insert(paymentWebhookLog).values({
      event: values.event,
      gatewayReference: values.gatewayReference,
      rawBody: values.rawBody,
      payload: values.payload,
      signatureValid: values.signatureValid ? 'true' : 'false',
      processedAt: new Date(),
    });
  }

  /** Selisih nominal dicatat sebagai konflik agar bisa diinvestigasi finance. */
  async recordMismatch(values: {
    outletId: string;
    orderId: string;
    gatewayReference: string;
    expected: number;
    received: number;
  }): Promise<void> {
    await this.db.insert(syncConflict).values({
      outletId: values.outletId,
      deviceId: 'payment-gateway',
      orderId: values.orderId,
      type: 'TOTAL_MISMATCH',
      deviceValue: { gateway_reference: values.gatewayReference, amount: values.received },
      cloudValue: { expected_total: values.expected },
      resolution: 'PENDING_REVIEW',
    });
  }

  async listPendingReconciliation(outletId: string, businessDate: string): Promise<PaymentRow[]> {
    return this.db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.outletId, outletId),
          eq(payment.status, 'PENDING'),
          sql`date(${payment.createdAt}) = ${businessDate}`,
        ),
      );
  }
}
