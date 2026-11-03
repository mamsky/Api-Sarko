import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../shared/decorators/public.decorator';
import { DrizzleService } from '../database/drizzle.service';
import { RedisService } from '../shared/redis/redis.service';

export type HealthResponse = {
  status: 'ok' | 'degraded';
  uptime: number;
  db: boolean;
  redis: boolean;
  version: string;
};

@ApiTags('health')
@Controller('v1/health')
export class HealthController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check nyata: SELECT 1 (PG) + PING (Redis)' })
  async check(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([this.drizzle.ping(), this.redis.ping()]);

    return {
      status: db && redis ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      db,
      redis,
      version: this.config.get<string>('npm_package_version', '0.1.0'),
    };
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Probe ringan untuk deteksi koneksi lapis-2 di klien' })
  ping(): { pong: true; server_time: string } {
    return { pong: true, server_time: new Date().toISOString() };
  }
}
