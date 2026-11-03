import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';
import { rupiahSchema } from '../common/money.js';

export const ingredientUnitSchema = z.enum(['GRAM', 'ML', 'PCS', 'SACHET']);
export type IngredientUnit = z.infer<typeof ingredientUnitSchema>;

export const recipeIngredientSchema = z.object({
  ingredient_id: uuidSchema,
  ingredient_name: z.string().min(1),
  qty: z.number().positive(),
  unit: ingredientUnitSchema,
  cost_per_unit: rupiahSchema.describe('Harga per satuan dasar (per gram / per ml / per pcs)'),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

/**
 * BOM (Bill of Materials) — PRD B4.
 * `hpp` (Harga Pokok Penjualan) dihitung server dari ingredients,
 * TIDAK dikirim client saat create/update.
 */
export const recipeSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  product_name: z.string().min(1),
  yield_qty: z.number().positive().describe('Jumlah porsi yang dihasilkan resep ini'),
  ingredients: z.array(recipeIngredientSchema),
  hpp: rupiahSchema.describe('Harga pokok penjualan per porsi — dihitung server'),
});
export type Recipe = z.infer<typeof recipeSchema>;
