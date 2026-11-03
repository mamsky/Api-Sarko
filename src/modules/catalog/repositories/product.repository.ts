import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import { category, modifierGroup, modifierOption, product, productModifierGroup } from '../../../database/schema';

export type ProductRow = typeof product.$inferSelect;
export type ModifierGroupRow = typeof modifierGroup.$inferSelect;
export type ModifierOptionRow = typeof modifierOption.$inferSelect;

export type ProductWithModifiers = ProductRow & {
  categoryName: string | null;
  modifierGroups: (ModifierGroupRow & { options: ModifierOptionRow[] })[];
};

/** Semua query katalog yang dibutuhkan modul ordering & sync. */
@Injectable()
export class ProductRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByIds(outletId: string, ids: readonly string[]): Promise<ProductWithModifiers[]> {
    if (ids.length === 0) {
      return [];
    }

    const products = await this.db
      .select({ product, categoryName: category.name })
      .from(product)
      .leftJoin(category, eq(category.id, product.categoryId))
      .where(
        and(
          eq(product.outletId, outletId),
          inArray(product.id, [...ids]),
          isNull(product.deletedAt),
        ),
      );

    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((row) => row.product.id);

    const links = await this.db
      .select({ group: modifierGroup, productId: productModifierGroup.productId })
      .from(productModifierGroup)
      .innerJoin(modifierGroup, eq(modifierGroup.id, productModifierGroup.modifierGroupId))
      .where(inArray(productModifierGroup.productId, productIds));

    const groupIds = [...new Set(links.map((link) => link.group.id))];
    const options =
      groupIds.length === 0
        ? []
        : await this.db
            .select()
            .from(modifierOption)
            .where(and(inArray(modifierOption.modifierGroupId, groupIds), isNull(modifierOption.deletedAt)));

    const optionsByGroup = new Map<string, ModifierOptionRow[]>();
    for (const option of options) {
      const list = optionsByGroup.get(option.modifierGroupId) ?? [];
      list.push(option);
      optionsByGroup.set(option.modifierGroupId, list);
    }

    const groupsByProduct = new Map<string, (ModifierGroupRow & { options: ModifierOptionRow[] })[]>();
    for (const link of links) {
      const list = groupsByProduct.get(link.productId) ?? [];
      list.push({ ...link.group, options: optionsByGroup.get(link.group.id) ?? [] });
      groupsByProduct.set(link.productId, list);
    }

    return products.map((row) => ({
      ...row.product,
      categoryName: row.categoryName,
      modifierGroups: groupsByProduct.get(row.product.id) ?? [],
    }));
  }

  async findModifierOptions(ids: readonly string[]): Promise<ModifierOptionRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.db
      .select()
      .from(modifierOption)
      .where(and(inArray(modifierOption.id, [...ids]), isNull(modifierOption.deletedAt)));
  }

  async listByOutlet(outletId: string): Promise<ProductWithModifiers[]> {
    const rows = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.outletId, outletId), isNull(product.deletedAt)));

    return this.findByIds(
      outletId,
      rows.map((row) => row.id),
    );
  }

  async setAvailability(
    tx: Database,
    outletId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<ProductRow | undefined> {
    const rows = await tx
      .update(product)
      .set({ isAvailable, updatedAt: new Date() })
      .where(and(eq(product.id, productId), eq(product.outletId, outletId)))
      .returning();
    return rows[0];
  }

  async updateAvailability(
    outletId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<ProductRow | undefined> {
    return this.setAvailability(this.db, outletId, productId, isAvailable);
  }

  async listCategories(outletId: string): Promise<(typeof category.$inferSelect)[]> {
    return this.db
      .select()
      .from(category)
      .where(and(eq(category.outletId, outletId), isNull(category.deletedAt)));
  }

  async findGroupsWithOptions(
    outletId: string,
  ): Promise<(ModifierGroupRow & { options: ModifierOptionRow[] })[]> {
    const groups = await this.db
      .select()
      .from(modifierGroup)
      .where(
        and(
          or(isNull(modifierGroup.outletId), eq(modifierGroup.outletId, outletId)),
          isNull(modifierGroup.deletedAt),
        ),
      );

    if (groups.length === 0) {
      return [];
    }

    const options = await this.db
      .select()
      .from(modifierOption)
      .where(
        and(
          inArray(
            modifierOption.modifierGroupId,
            groups.map((group) => group.id),
          ),
          isNull(modifierOption.deletedAt),
        ),
      );

    const byGroup = new Map<string, ModifierOptionRow[]>();
    for (const option of options) {
      const list = byGroup.get(option.modifierGroupId) ?? [];
      list.push(option);
      byGroup.set(option.modifierGroupId, list);
    }

    return groups.map((group) => ({ ...group, options: byGroup.get(group.id) ?? [] }));
  }
}
