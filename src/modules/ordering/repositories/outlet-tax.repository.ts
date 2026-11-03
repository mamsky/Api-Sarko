import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import { outlet, promotion, taxConfig, voucher } from '../../../database/schema';

export type OutletRow = typeof outlet.$inferSelect;
export type TaxConfigRow = typeof taxConfig.$inferSelect;

export type VoucherTerms = {
  discountType: 'PERCENT' | 'AMOUNT';
  discountBps: number;
  discountAmount: number;
  maxDiscount: number;
  minPurchase: number;
};

/** Data outlet, pajak, dan voucher yang dibutuhkan modul ordering. */
@Injectable()
export class OutletTaxRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<OutletRow | undefined> {
    const rows = await this.db.select().from(outlet).where(eq(outlet.id, id)).limit(1);
    return rows[0];
  }

  async listActive(): Promise<OutletRow[]> {
    return this.db.select().from(outlet).where(eq(outlet.isActive, true));
  }

  async findActiveTaxConfig(outletId: string): Promise<TaxConfigRow | undefined> {
    const rows = await this.db
      .select()
      .from(taxConfig)
      .where(and(eq(taxConfig.outletId, outletId), eq(taxConfig.isActive, 'true')))
      .orderBy(sql`${taxConfig.effectiveFrom} DESC`)
      .limit(1);
    return rows[0];
  }

  /**
   * Voucher aktif + aturan promo terkait. Diskon dihitung pemanggil dari sini —
   * nominal dari client tidak pernah dipercaya.
   */
  async findActiveVoucher(outletId: string, code: string): Promise<VoucherTerms | undefined> {
    const rows = await this.db
      .select({
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
    if (row === undefined || !row.voucherActive) {
      return undefined;
    }
    if (row.expiresAt !== null && row.expiresAt.getTime() < Date.now()) {
      return undefined;
    }
    if (row.maxRedemptions > 0 && row.redemptionCount >= row.maxRedemptions) {
      return undefined;
    }
    if (row.promotionActive === false) {
      return undefined;
    }

    return {
      discountType: (row.discountType ?? 'PERCENT') as VoucherTerms['discountType'],
      discountBps: row.discountBps ?? 0,
      discountAmount: row.discountAmount ?? 0,
      maxDiscount: row.maxDiscount ?? 0,
      minPurchase: row.minPurchase ?? 0,
    };
  }
}
