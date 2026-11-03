import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { RolesGuard } from '../identity/roles.guard';
import { LoyaltyService } from './loyalty.service';

const adjustSchema = z.object({
  customer_id: z.string().uuid(),
  points: z.number().int(),
  reason: z.string().min(5).max(500),
});

const ledgerQuerySchema = z.object({
  customer_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('v1/loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('balance/:customerId')
  @ApiOperation({ summary: 'Saldo poin pelanggan' })
  async balance(
    @Param('customerId') customerId: string,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.loyalty.getBalance(outletIds[0] ?? '', customerId);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Riwayat ledger poin (append-only)' })
  async ledger(
    @Query(new ZodValidationPipe(ledgerQuerySchema)) query: z.infer<typeof ledgerQuerySchema>,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.loyalty.listLedger(outletIds[0] ?? '', query.customer_id, query.limit);
  }

  @Post('adjust')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET')
  @ApiOperation({ summary: 'Penyesuaian poin manual (ledger append-only)' })
  async adjust(
    @Body(new ZodValidationPipe(adjustSchema)) body: z.infer<typeof adjustSchema>,
    @CurrentUser('id') actorId: string,
    @CurrentUser('outletIds') outletIds: string[],
  ) {
    return this.loyalty.adjust(
      outletIds[0] ?? '',
      body.customer_id,
      body.points,
      body.reason,
      actorId,
    );
  }
}
