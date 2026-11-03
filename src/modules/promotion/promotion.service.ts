import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { promotion, voucher, voucherRedemption } from '../../database/schema';
import { AppError } from '../../shared/errors/app-error';
import { percent } from '../../shared/money/money';

export type VoucherValidation = {
  valid: boolean;
  voucher_id: string;
  discount_amount: number;
  reason?: string;
};

/** Promosi & voucher (PRD FR-ADM-04). Diskon selalu dihitung server. */
@Injectable()
export class PromotionService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listActive(outletId: string) {
    const rows = await this.db
      .select()
      .from(promotion)
      .where(and(eq(promotion.outletId, outletId), eq(promotion.isActive, true)));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      discount_type: row.discountType,
      discount_bps: row.discountBps,
      discount_amount: row.discountAmount,
      min_purchase: row.minPurchase,
      max_discount: row.maxDiscount,
      stacking_rule: row.stackingRule,
      starts_at: row.startsAt?.toISOString() ?? null,
      ends_at: row.endsAt?.toISOString() ?? null,
    }));
  }

  /**
   * Validasi voucher terhadap subtotal. Aturan stacking default EXCLUSIVE:
   * satu voucher per order — dua voucher ditolak, bukan digabung diam-diam.
   */
  async validateVoucher(outletId: string, code: string, subtotal: number): Promise<VoucherValidation> {
    const rows = await this.db
      .select({
        voucherId: voucher.id,
        maxRedemptions: voucher.maxRedemptions,
        redemptionCount: voucher.redemptionCount,
        expiresAt: voucher.expiresAt,
        voucherActive: voucher.isActive,
        discountType: promotion.discountType,
        discountBps: promotion.discountBps,
        discountAmount: promotion.discountAmount,
        maxDiscount: promotion.maxDiscount,
        minPurchase: promotion.minPurchase,
        promotionActive: promotion.isActive,
      })
      .from(voucher)
      .leftJoin(promotion, eq(promotion.id, voucher.promotionId))
      .where(and(eq(voucher.outletId, outletId), eq(voucher.code, code)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      return { valid: false, voucher_id: '', discount_amount: 0, reason: 'Voucher tidak ditemukan' };
    }
    if (!row.voucherActive) {
      return { valid: false, voucher_id: row.voucherId, discount_amount: 0, reason: 'Voucher tidak aktif' };
    }
    if (row.expiresAt !== null && row.expiresAt.getTime() < Date.now()) {
      return { valid: false, voucher_id: row.voucherId, discount_amount: 0, reason: 'Voucher kedaluwarsa' };
    }
    if (row.maxRedemptions > 0 && row.redemptionCount >= row.maxRedemptions) {
      return { valid: false, voucher_id: row.voucherId, discount_amount: 0, reason: 'Kuota voucher habis' };
    }
    const minPurchase = row.minPurchase ?? 0;
    if (minPurchase > 0 && subtotal < minPurchase) {
      return {
        valid: false,
        voucher_id: row.voucherId,
        discount_amount: 0,
        reason: `Minimal belanja ${minPurchase}`,
      };
    }

    const raw =
      row.discountType === 'PERCENT'
        ? percent(subtotal, row.discountBps ?? 0)
        : (row.discountAmount ?? 0);
    const maxDiscount = row.maxDiscount ?? 0;
    const capped = maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw;

    return {
      valid: true,
      voucher_id: row.voucherId,
      discount_amount: Math.min(capped, subtotal),
    };
  }

  async redeem(voucherId: string, orderId: string, customerId: string | null, discountAmount: number) {
    if (voucherId.length === 0) {
      throw AppError.validation('Voucher tidak valid');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .insert(voucherRedemption)
        .values({ outletId: '', voucherId, orderId, customerId, discountAmount })
        .onConflictDoNothing();

      await tx
        .update(voucher)
        .set({ redemptionCount: sql`${voucher.redemptionCount} + 1`, updatedAt: new Date() })
        .where(eq(voucher.id, voucherId));
    });

    return { redeemed: true };
  }
}
