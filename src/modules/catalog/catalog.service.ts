import { Injectable } from '@nestjs/common';
import type { Category, Product } from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';
import { ProductRepository } from './repositories/product.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly products: ProductRepository) {}

  async listProducts(outletId: string): Promise<Product[]> {
    const rows = await this.products.listByOutlet(outletId);
    return rows.map(toProductContract);
  }

  async getProduct(outletId: string, productId: string): Promise<Product> {
    const rows = await this.products.findByIds(outletId, [productId]);
    const row = rows[0];
    if (row === undefined) {
      throw AppError.notFound('Produk');
    }
    return toProductContract(row);
  }

  async listCategories(outletId: string): Promise<Category[]> {
    const rows = await this.products.listCategories(outletId);
    return rows.map((row) => ({
      id: row.id,
      outlet_id: row.outletId,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
    }));
  }

  async setAvailability(
    outletId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<{ product_id: string; is_available: boolean }> {
    const updated = await this.products.updateAvailability(outletId, productId, isAvailable);
    if (updated === undefined) {
      throw AppError.notFound('Produk');
    }
    return { product_id: updated.id, is_available: updated.isAvailable };
  }
}

function toProductContract(row: {
  id: string;
  outletId: string;
  categoryId: string;
  sku: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  station: string;
  isAvailable: boolean;
  prepTimeMinutes: number;
  sortOrder: number;
  modifierGroups: {
    id: string;
    name: string;
    selectionType: string;
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    options: {
      id: string;
      name: string;
      priceDelta: number;
      isDefault: boolean;
      sortOrder: number;
    }[];
  }[];
}): Product {
  return {
    id: row.id,
    outlet_id: row.outletId,
    category_id: row.categoryId,
    sku: row.sku,
    name: row.name,
    description: row.description,
    base_price: row.basePrice,
    image_url: row.imageUrl,
    station: row.station as Product['station'],
    is_available: row.isAvailable,
    modifier_groups: row.modifierGroups.map((group) => ({
      id: group.id,
      name: group.name,
      selection_type: group.selectionType as 'SINGLE' | 'MULTIPLE',
      is_required: group.isRequired,
      min_select: group.minSelect,
      max_select: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        price_delta: option.priceDelta,
        is_default: option.isDefault,
        sort_order: option.sortOrder,
      })),
    })),
    prep_time_minutes: row.prepTimeMinutes,
    sort_order: row.sortOrder,
  };
}
