import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { outboxEvent } from '../../database/schema';

export type OutboxEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  outletId?: string | null;
};

/**
 * Transactional outbox (AD-04, PRD §7.11).
 *
 * `enqueue` WAJIB dipanggil dengan `tx` yang sama seperti perubahan data,
 * supaya event dan data commit/rollback bersama. Relay worker yang
 * mem-publish; service tidak pernah publish langsung.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async enqueue(tx: Database, event: OutboxEventInput): Promise<void> {
    await tx.insert(outboxEvent).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      outletId: event.outletId ?? null,
      status: 'PENDING',
    });
  }

  /** Ambil batch event PENDING yang sudah waktunya dikirim (relay worker). */
  async claimPending(limit = 100): Promise<
    { id: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown }[]
  > {
    const rows = await this.db
      .select({
        id: outboxEvent.id,
        aggregateType: outboxEvent.aggregateType,
        aggregateId: outboxEvent.aggregateId,
        eventType: outboxEvent.eventType,
        payload: outboxEvent.payload,
      })
      .from(outboxEvent)
      .where(and(eq(outboxEvent.status, 'PENDING'), lte(outboxEvent.availableAt, new Date())))
      .orderBy(asc(outboxEvent.createdAt))
      .limit(limit);

    return rows;
  }

  async markSent(id: string): Promise<void> {
    await this.db
      .update(outboxEvent)
      .set({ status: 'SENT', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(outboxEvent.id, id));
  }

  /**
   * Gagal kirim: tambah `attempts`, jadwalkan ulang dengan backoff eksponensial,
   * dan tandai FAILED setelah 5 percobaan agar tidak hilang diam-diam.
   */
  async markFailed(id: string, error: string, attempts: number): Promise<void> {
    const backoffMs = Math.min(2 ** attempts * 1_000, 300_000);
    const nextAttempt = new Date(Date.now() + backoffMs);
    const status = attempts >= 5 ? 'FAILED' : 'PENDING';

    await this.db
      .update(outboxEvent)
      .set({
        status,
        attempts,
        lastError: error.slice(0, 2_000),
        availableAt: nextAttempt,
        updatedAt: new Date(),
      })
      .where(eq(outboxEvent.id, id));

    this.logger.warn({ id, attempts, status }, 'Outbox event gagal dikirim');
  }

  async countPending(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvent)
      .where(eq(outboxEvent.status, 'PENDING'));
    return rows[0]?.count ?? 0;
  }
}
