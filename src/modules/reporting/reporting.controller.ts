import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { RolesGuard } from '../identity/roles.guard';
import { ReportingService } from './reporting.service';

const reportQuerySchema = z.object({
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outlet_id: z.string().uuid().optional(),
});

const topQuerySchema = reportQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('v1/reports')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('sales')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET')
  @ApiOperation({ summary: 'Laporan penjualan harian berbasis business_date' })
  async sales(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: z.infer<typeof reportQuerySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.reporting.salesReport(query.outlet_id ?? outletIds[0] ?? '', query.business_date);
  }

  @Get('top-products')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET')
  @ApiOperation({ summary: 'Produk terlaris pada satu hari bisnis' })
  async topProducts(
    @Query(new ZodValidationPipe(topQuerySchema)) query: z.infer<typeof topQuerySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.reporting.topProducts(
      query.outlet_id ?? outletIds[0] ?? '',
      query.business_date,
      4,
      query.limit,
    );
  }

  @Get('sales.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET')
  @ApiOperation({ summary: 'Unduh laporan penjualan sebagai CSV' })
  async salesCsv(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: z.infer<typeof reportQuerySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ): Promise<string> {
    return this.reporting.exportSalesCsv(
      query.outlet_id ?? outletIds[0] ?? '',
      query.business_date,
    );
  }
}
