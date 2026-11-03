import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Category, type Product, productAvailabilitySchema } from '@sarko/contracts';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { RolesGuard } from '../identity/roles.guard';
import { CatalogService } from './catalog.service';

const outletQuerySchema = z.object({ outlet_id: z.string().uuid().optional() });

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('v1/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'Daftar produk + modifier group untuk outlet' })
  async listProducts(
    @CurrentUser('outletIds') outletIds: string[],
    @Query(new ZodValidationPipe(outletQuerySchema)) query: z.infer<typeof outletQuerySchema>,
  ): Promise<Product[]> {
    return this.catalog.listProducts(query.outlet_id ?? outletIds[0] ?? '');
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Detail satu produk' })
  async getProduct(
    @Param('id') id: string,
    @CurrentUser('outletIds') outletIds: string[],
  ): Promise<Product> {
    return this.catalog.getProduct(outletIds[0] ?? '', id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Daftar kategori' })
  async listCategories(
    @CurrentUser('outletIds') outletIds: string[],
    @Query(new ZodValidationPipe(outletQuerySchema)) query: z.infer<typeof outletQuerySchema>,
  ): Promise<Category[]> {
    return this.catalog.listCategories(query.outlet_id ?? outletIds[0] ?? '');
  }

  @Patch('availability')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET', 'KASIR', 'KOKI')
  @ApiOperation({ summary: 'Ubah ketersediaan produk (sering dipakai saat jam sibuk)' })
  async setAvailability(
    @Body(new ZodValidationPipe(productAvailabilitySchema))
    body: z.infer<typeof productAvailabilitySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ): Promise<{ product_id: string; is_available: boolean }> {
    return this.catalog.setAvailability(
      outletIds[0] ?? '',
      body.product_id,
      body.is_available,
    );
  }
}
