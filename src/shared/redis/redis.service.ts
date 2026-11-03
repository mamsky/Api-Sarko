import { Global, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    this.client.on('error', (error) => {
      this.logger.warn({ err: error }, 'Koneksi Redis bermasalah');
    });
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn({ err: error }, 'PING Redis gagal');
      return false;
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.client.publish(channel, JSON.stringify(payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
