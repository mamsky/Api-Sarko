import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { PromotionService } from './promotion.service';

const validateQuerySchema = z.object({
  code: z.string().min(1).max(50),
  subtotal: z.coerce.number().int().nonnegative(),
});

@ApiTags('promotion')
@ApiBearerAuth()
@Controller('v1/promotions')
export class PromotionController {
  constructor(private readonly promotions: PromotionService) {}

  @Get()
  @ApiOperation({ summary: 'Promo aktif untuk outlet' })
  async list(@CurrentUser('outletIds') outletIds: string[]) {
    return this.promotions.listActive(outletIds[0] ?? '');
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validasi kode voucher terhadap subtotal (diskon dihitung server)' })
  async validate(
    @Query(new ZodValidationPipe(validateQuerySchema)) query: z.infer<typeof validateQuerySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.promotions.validateVoucher(outletIds[0] ?? '', query.code, query.subtotal);
  }
}
