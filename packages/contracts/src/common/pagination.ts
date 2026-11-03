import { z } from 'zod';

/**
 * Paginasi SARKO memakai cursor (keyset), BUKAN offset.
 * Alasan: data order bertambah terus saat jam sibuk — offset pagination akan
 * menghasilkan duplikat/hilang baris ketika ada insert di tengah.
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor dari response sebelumnya'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type Paginated<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};

/**
 * Helper generic: bungkus schema item apa pun menjadi response paginasi.
 * Contoh: `paginatedSchema(orderSummarySchema)`.
 */
export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  });
}
