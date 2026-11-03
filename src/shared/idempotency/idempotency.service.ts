import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { idempotencyKey } from '../../database/schema';

export type CachedResult = {
  statusCode: number;
  responseBody: unknown;
};

export type IdempotencyDecision =
  | { outcome: 'PROCEED' }
  | { outcome: 'REPLAY'; cached: CachedResult };

/**
 * Idempotency-Key store (PRD FR-PAY-01).
 *
 * Aturan:
 * - key belum ada → insert baris lock, lanjutkan request
 * - key ada + hash SAMA + sudah selesai → REPLAY body tersimpan
 * - key ada + hash SAMA + belum selesai → tolak (request lain masih jalan)
 * - key ada + hash BEDA → 409 IDEMPOTENCY_KEY_REUSED
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private static readonly TTL_HOURS = 24;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async checkOrCreate(key: string, requestHash: string, actorId: string): Promise<IdempotencyDecision> {
    const existing = await this.find(key, actorId);

    if (existing !== undefined) {
      if (existing.requestHash !== requestHash) {
        return { outcome: 'REPLAY', cached: { statusCode: 409, responseBody: null } };
      }
      if (existing.statusCode !== null && existing.responseBody !== null) {
        return {
          outcome: 'REPLAY',
          cached: {
            statusCode: existing.statusCode,
            responseBody: existing.responseBody,
          },
        };
      }
      // Baris ada tapi belum selesai: request paralel dengan key yang sama.
      return { outcome: 'REPLAY', cached: { statusCode: 409, responseBody: null } };
    }

    const expiresAt = new Date(Date.now() + IdempotencyService.TTL_HOURS * 3_600_000);
    await this.db
      .insert(idempotencyKey)
      .values({ key, actorId, requestHash, expiresAt })
      .onConflictDoNothing();

    return { outcome: 'PROCEED' };
  }

  async find(
    key: string,
    actorId: string,
  ): Promise<
    | { requestHash: string; statusCode: number | null; responseBody: unknown }
    | undefined
  > {
    const rows = await this.db
      .select({
        requestHash: idempotencyKey.requestHash,
        statusCode: idempotencyKey.statusCode,
        responseBody: idempotencyKey.responseBody,
      })
      .from(idempotencyKey)
      .where(and(eq(idempotencyKey.key, key), eq(idempotencyKey.actorId, actorId)))
      .limit(1);

    return rows[0];
  }

  async store(key: string, actorId: string, result: CachedResult): Promise<void> {
    await this.db
      .update(idempotencyKey)
      .set({
        statusCode: result.statusCode,
        responseBody: result.responseBody as never,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(idempotencyKey.key, key), eq(idempotencyKey.actorId, actorId)));
  }

  /** Bersihkan key kedaluwarsa (dipanggil job harian). */
  async purgeExpired(): Promise<number> {
    const deleted = await this.db
      .delete(idempotencyKey)
      .where(lt(idempotencyKey.expiresAt, new Date()))
      .returning({ id: idempotencyKey.id });

    if (deleted.length > 0) {
      this.logger.log({ count: deleted.length }, 'Idempotency key kedaluwarsa dibersihkan');
    }
    return deleted.length;
  }

  async countActive(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(idempotencyKey);
    return rows[0]?.count ?? 0;
  }
}
