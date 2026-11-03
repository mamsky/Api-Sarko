import 'reflect-metadata';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

import * as schema from '../schema';
import { env } from '../../config/env';
import {
  CATEGORIES,
  INGREDIENTS,
  MODIFIER_GROUPS,
  OUTLET,
  PRODUCTS,
  RECIPES,
  ROLES,
  TABLES,
  USERS,
} from './products.seed';

const DEFAULT_PASSWORD = 'Sarko123!';
const DEFAULT_PIN = '123456';

/**
 * Seed idempoten — aman dijalankan berulang.
 *
 * Setiap insert memakai `onConflictDoNothing`/`onConflictDoUpdate` pada kunci
 * natural (kode, email, sku), jadi run kedua tidak menduplikasi data dan tidak
 * melempar error unique constraint.
 */
async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });
    const pinHash = await argon2.hash(DEFAULT_PIN, { type: argon2.argon2id });

    await db
      .insert(schema.outlet)
      .values({
        id: OUTLET.id,
        code: OUTLET.code,
        name: OUTLET.name,
        timezone: OUTLET.timezone,
        cutoffHour: OUTLET.cutoffHour,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.outlet.code,
        set: { name: OUTLET.name, timezone: OUTLET.timezone, cutoffHour: OUTLET.cutoffHour },
      });

    await db
      .insert(schema.role)
      .values(ROLES.map((role) => ({ code: role.code, name: role.name })))
      .onConflictDoNothing({ target: schema.role.code });

    await db
      .insert(schema.user)
      .values(
        USERS.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash,
          pinHash,
          roleCode: user.roleCode,
          isActive: true,
        })),
      )
      .onConflictDoUpdate({
        target: schema.user.email,
        set: { passwordHash, pinHash, name: sql`excluded.name` },
      });

    await db
      .insert(schema.userOutlet)
      .values(USERS.map((user) => ({ userId: user.id, outletId: OUTLET.id })))
      .onConflictDoNothing();

    await db
      .insert(schema.category)
      .values(
        CATEGORIES.map((category) => ({
          id: category.id,
          outletId: OUTLET.id,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    const categoryByName = new Map(CATEGORIES.map((category) => [category.name, category.id]));

    for (const group of MODIFIER_GROUPS) {
      await db
        .insert(schema.modifierGroup)
        .values({
          id: group.id,
          outletId: OUTLET.id,
          name: group.name,
          selectionType: group.selectionType,
          isRequired: group.isRequired,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          sortOrder: group.sortOrder,
        })
        .onConflictDoNothing();

      await db
        .insert(schema.modifierOption)
        .values(
          group.options.map((option) => ({
            id: option.id,
            modifierGroupId: group.id,
            name: option.name,
            priceDelta: option.priceDelta,
            isDefault: option.isDefault,
            sortOrder: option.sortOrder,
          })),
        )
        .onConflictDoNothing();
    }

    const groupByName = new Map(MODIFIER_GROUPS.map((group) => [group.name, group.id]));

    for (const [index, product] of PRODUCTS.entries()) {
      const categoryId = categoryByName.get(product.category);
      if (categoryId === undefined) {
        throw new Error(`Kategori "${product.category}" tidak ada di seed`);
      }

      const productId = `00000000-0000-4000-8000-${String(1000 + index).padStart(12, '0')}`;

      await db
        .insert(schema.product)
        .values({
          id: productId,
          outletId: OUTLET.id,
          categoryId,
          sku: product.sku,
          name: product.name,
          description: null,
          basePrice: product.basePrice,
          station: product.station,
          isAvailable: true,
          prepTimeMinutes: product.prepTimeMinutes,
          sortOrder: index,
        })
        .onConflictDoUpdate({
          target: [schema.product.outletId, schema.product.sku],
          set: { basePrice: product.basePrice, name: product.name },
        });

      for (const groupName of product.modifiers) {
        const groupId = groupByName.get(groupName);
        if (groupId === undefined) {
          continue;
        }
        await db
          .insert(schema.productModifierGroup)
          .values({ productId, modifierGroupId: groupId })
          .onConflictDoNothing();
      }
    }

    await db
      .insert(schema.diningTable)
      .values(
        TABLES.map((table) => ({
          id: table.id,
          outletId: OUTLET.id,
          label: table.label,
          area: table.area,
          seats: table.seats,
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    await db
      .insert(schema.ingredient)
      .values(
        INGREDIENTS.map((ingredient) => ({
          id: ingredient.id,
          outletId: OUTLET.id,
          sku: ingredient.sku,
          name: ingredient.name,
          unit: ingredient.unit,
          costPerUnit: ingredient.costPerUnit,
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    await db
      .insert(schema.stockLevel)
      .values(
        INGREDIENTS.map((ingredient) => ({
          outletId: OUTLET.id,
          ingredientId: ingredient.id,
          qtyOnHand: '10000',
          lowStockThreshold: '1000',
        })),
      )
      .onConflictDoNothing();

    const ingredientBySku = new Map(INGREDIENTS.map((ingredient) => [ingredient.sku, ingredient.id]));
    const productBySku = await db
      .select({ id: schema.product.id, sku: schema.product.sku })
      .from(schema.product)
      .where(eq(schema.product.outletId, OUTLET.id));
    const productIdBySku = new Map(productBySku.map((product) => [product.sku, product.id]));

    for (const [index, recipe] of RECIPES.entries()) {
      const productId = productIdBySku.get(recipe.productSku);
      if (productId === undefined) {
        continue;
      }

      const recipeId = `00000000-0000-4000-8000-${String(2000 + index).padStart(12, '0')}`;

      await db
        .insert(schema.recipe)
        .values({
          id: recipeId,
          outletId: OUTLET.id,
          productId,
          yieldQty: String(recipe.yieldQty),
          hpp: 0,
        })
        .onConflictDoNothing();

      for (const item of recipe.items) {
        const ingredientId = ingredientBySku.get(item.ingredientSku);
        if (ingredientId === undefined) {
          continue;
        }
        await db
          .insert(schema.recipeItem)
          .values({
            recipeId,
            ingredientId,
            qty: String(item.qty),
            unit: item.unit,
          })
          .onConflictDoNothing();
      }
    }

    await db
      .insert(schema.taxConfig)
      .values({
        outletId: OUTLET.id,
        name: 'PB1',
        rateBps: 1000,
        serviceChargeBps: 0,
        isInclusive: 'false',
        isActive: 'true',
      })
      .onConflictDoNothing();

    process.stdout.write(
      `Seed selesai: 1 outlet, ${USERS.length} user, ${CATEGORIES.length} kategori, ${PRODUCTS.length} produk, ${TABLES.length} meja, ${INGREDIENTS.length} bahan, ${RECIPES.length} resep.\n`,
    );
  } finally {
    await pool.end();
  }
}

void seed().catch((error: unknown) => {
  process.stderr.write(`Seed gagal: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
