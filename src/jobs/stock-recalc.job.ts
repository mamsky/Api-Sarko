import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/drizzle.service';
import { ingredient } from '../database/schema';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Hitung ulang stok dari `stock_movement` (append-only ledger).
 *
 * Berguna mendeteksi drift: bila `stock_level.qty_on_hand` berbeda dari
 * jumlah movement, angka movement yang benar (itu yang diaudit).
 */
@Injectable()
export class StockRecalcJob {
  private readonly logger = new Logger(StockRecalcJob.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly inventory: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async recalculateAll(): Promise<void> {
    const outlets = await this.db.select({ id: ingredient.outletId }).from(ingredient).groupBy(ingredient.outletId);

    for (const outlet of outlets) {
      const rows = await this.db
        .select({ id: ingredient.id })
        .from(ingredient)
        .where(eq(ingredient.outletId, outlet.id));

      for (const row of rows) {
        const total = await this.inventory.recalculate(this.db, outlet.id, row.id);
        this.logger.debug({ outletId: outlet.id, ingredientId: row.id, total }, 'Stok dihitung ulang');
      }
    }
  }
}
