import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Order,
  type OrderSummary,
  createOrderSchema,
  orderStatusSchema,
  paginationQuerySchema,
} from '@sarko/contracts';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { RolesGuard } from '../identity/roles.guard';
import { OrderingService } from './ordering.service';

const listQuerySchema = paginationQuerySchema.extend({
  outlet_id: z.string().uuid().optional(),
  status: z.string().optional(),
  channel: z.string().optional(),
  business_date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const transitionSchema = z.object({
  to: orderStatusSchema,
  reason: z.string().max(500).optional(),
});

const itemStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'HOLD']),
});

@ApiTags('ordering')
@ApiBearerAuth()
@Controller('v1/orders')
export class OrderingController {
  constructor(private readonly ordering: OrderingService) {}

  @Post()
  @ApiOperation({ summary: 'Buat order (harga & pajak dihitung ulang di server)' })
  async create(
    @CurrentUser('id') actorId: string,
    @CurrentUser('outletIds') outletIds: string[],
    @Body(new ZodValidationPipe(createOrderSchema)) body: z.infer<typeof createOrderSchema>,
  ): Promise<Order> {
    return this.ordering.create(actorId, body, { outletId: outletIds[0] });
  }

  @Get()
  @ApiOperation({ summary: 'Daftar order dengan cursor pagination' })
  async list(
    @CurrentUser('id') actorId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ): Promise<{ data: OrderSummary[]; next_cursor: string | null; has_more: boolean }> {
    return this.ordering.list(query, actorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail order beserta item & modifier' })
  async getById(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<Order> {
    return this.ordering.getById(id, actorId);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET', 'KASIR', 'KOKI')
  @ApiOperation({ summary: 'Transisi status order (divalidasi state machine)' })
  async transition(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(transitionSchema)) body: z.infer<typeof transitionSchema>,
  ): Promise<Order> {
    return this.ordering.transition(id, body.to, actorId, { reason: body.reason });
  }

  @Patch(':id/items/:itemId/status')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET', 'KOKI', 'KASIR')
  @ApiOperation({ summary: 'Ubah status item (KDS); READY otomatis saat semua item DONE' })
  async updateItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(itemStatusSchema)) body: z.infer<typeof itemStatusSchema>,
  ): Promise<{ ok: true }> {
    await this.ordering.updateItemStatus(id, itemId, body.status, actorId);
    return { ok: true };
  }
}
