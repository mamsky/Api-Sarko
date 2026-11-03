import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { loyaltyAccount, loyaltyLedger } from '../../database/schema';
import { AppError } from '../../shared/errors/app-error';

export type LoyaltyBalance = {
  account_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: string;
};

export type LoyaltyEntry = {
  id: string;
  type: string;
  points_delta: number;
  balance_after: number;
  order_id: string | null;
  created_at: string;
};

/** Loyalty read-side (PRD FR-APP-07). Penulisan poin terjadi di PaymentService. */
@Injectable()
export class LoyaltyService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getBalance(outletId: string, customerId: string): Promise<LoyaltyBalance> {
    const rows = await this.db
      .select()
      .from(loyaltyAccount)
      .where(
        and(eq(loyaltyAccount.outletId, outletId), eq(loyaltyAccount.customerId, customerId)),
      )
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      return {
        account_id: '',
        points_balance: 0,
        lifetime_points: 0,
        tier: 'BRONZE',
      };
    }

    return {
      account_id: row.id,
      points_balance: row.pointsBalance,
      lifetime_points: row.lifetimePoints,
      tier: row.tier,
    };
  }

  async listLedger(outletId: string, customerId: string, limit = 50): Promise<LoyaltyEntry[]> {
    const account = await this.db
      .select({ id: loyaltyAccount.id })
      .from(loyaltyAccount)
      .where(
        and(eq(loyaltyAccount.outletId, outletId), eq(loyaltyAccount.customerId, customerId)),
      )
      .limit(1);

    const accountId = account[0]?.id;
    if (accountId === undefined) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.accountId, accountId))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      points_delta: row.pointsDelta,
      balance_after: row.balanceAfter,
      order_id: row.orderId,
      created_at: row.createdAt.toISOString(),
    }));
  }

  /** Reversal manual oleh manager (ledger append-only, tidak menghapus entri). */
  async adjust(
    outletId: string,
    customerId: string,
    points: number,
    reason: string,
    actorId: string,
  ): Promise<LoyaltyBalance> {
    if (!Number.isInteger(points) || points === 0) {
      throw AppError.validation('Penyesuaian poin harus integer dan tidak nol');
    }

    const rows = await this.db
      .select()
      .from(loyaltyAccount)
      .where(
        and(eq(loyaltyAccount.outletId, outletId), eq(loyaltyAccount.customerId, customerId)),
      )
      .limit(1);

    let account = rows[0];
    if (account === undefined) {
      const inserted = await this.db
        .insert(loyaltyAccount)
        .values({ outletId, customerId, pointsBalance: 0, lifetimePoints: 0 })
        .returning();
      account = inserted[0];
      if (account === undefined) {
        throw AppError.internal('Gagal membuat akun loyalty');
      }
    }

    const balanceAfter = account.pointsBalance + points;
    if (balanceAfter < 0) {
      throw AppError.validation('Saldo poin tidak boleh negatif');
    }

    await this.db
      .update(loyaltyAccount)
      .set({ pointsBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(loyaltyAccount.id, account.id));

    await this.db.insert(loyaltyLedger).values({
      outletId,
      accountId: account.id,
      type: 'ADJUSTMENT',
      pointsDelta: points,
      balanceAfter,
      note: reason,
      actorId,
    });

    return {
      account_id: account.id,
      points_balance: balanceAfter,
      lifetime_points: account.lifetimePoints,
      tier: account.tier,
    };
  }
}
