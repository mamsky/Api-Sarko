import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';
import { rupiahSchema } from '../common/money.js';
import { stationSchema } from '../ordering/order.schema.js';

export const selectionTypeSchema = z.enum(['SINGLE', 'MULTIPLE']);
export type SelectionType = z.infer<typeof selectionTypeSchema>;

export const modifierOptionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  price_delta: rupiahSchema.describe('Tambahan harga, 0 bila gratis'),
  is_default: z.boolean(),
  sort_order: z.number().int(),
});
export type ModifierOption = z.infer<typeof modifierOptionSchema>;

export const modifierGroupSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    selection_type: selectionTypeSchema,
    is_required: z.boolean(),
    min_select: z.number().int().nonnegative(),
    max_select: z.number().int().positive(),
    options: z.array(modifierOptionSchema),
  })
  .refine((group) => group.max_select >= group.min_select, {
    message: 'max_select harus >= min_select',
    path: ['max_select'],
  })
  .refine((group) => group.selection_type !== 'SINGLE' || group.max_select === 1, {
    message: 'selection_type SINGLE harus memiliki max_select = 1',
    path: ['max_select'],
  })
  .refine((group) => !group.is_required || group.min_select >= 1, {
    message: 'Grup wajib (is_required) harus memiliki min_select >= 1',
    path: ['min_select'],
  });
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

export const categorySchema = z.object({
  id: uuidSchema,
  outlet_id: uuidSchema,
  name: z.string().min(1),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  id: uuidSchema,
  outlet_id: uuidSchema,
  category_id: uuidSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  base_price: rupiahSchema,
  image_url: z.string().nullable(),
  station: stationSchema,
  is_available: z.boolean(),
  modifier_groups: z.array(modifierGroupSchema).describe('Grup modifier tertanam — bukan tabel relasi terpisah'),
  prep_time_minutes: z.number().int().nonnegative(),
  sort_order: z.number().int(),
});
export type Product = z.infer<typeof productSchema>;

/** Payload ringkas untuk update ketersediaan dari KDS/POS (sering berubah saat jam sibuk). */
export const productAvailabilitySchema = z.object({
  product_id: uuidSchema,
  is_available: z.boolean(),
});
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;
