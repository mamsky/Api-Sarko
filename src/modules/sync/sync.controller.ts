import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type SyncPushResponse,
  syncPullQuerySchema,
  syncPushRequestSchema,
} from '@sarko/contracts';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { SyncService } from './sync.service';

const healthQuerySchema = z.object({ device_id: z.string().min(1) });

@ApiTags('sync')
@ApiBearerAuth()
@Controller('v1/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kirim batch command offline (maks 50) — idempoten per command_id' })
  async push(
    @Body(new ZodValidationPipe(syncPushRequestSchema)) body: z.infer<typeof syncPushRequestSchema>,
    @CurrentUser('id') actorId: string,
  ): Promise<SyncPushResponse> {
    return this.sync.push(body, { actorId, outletId: body.outlet_id, deviceId: body.device_id });
  }

  @Get('pull')
  @ApiOperation({ summary: 'Ambil perubahan master + order kanal lain sejak cursor' })
  async pull(
    @Query(new ZodValidationPipe(syncPullQuerySchema)) query: z.infer<typeof syncPullQuerySchema>,
    @Req() request: { headers?: Record<string, string | string[] | undefined> },
  ) {
    const header = request.headers?.['x-device-time'];
    const deviceTime = typeof header === 'string' ? new Date(header) : undefined;
    return this.sync.pull(query, deviceTime);
  }

  @Get('health')
  @ApiOperation({ summary: 'Status antrean sync perangkat' })
  async health(@Query(new ZodValidationPipe(healthQuerySchema)) query: z.infer<typeof healthQuerySchema>) {
    return this.sync.health(query.device_id);
  }
}
