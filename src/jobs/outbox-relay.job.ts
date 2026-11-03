import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OutboxService } from '../shared/outbox/outbox.service';
import { RedisService } from '../shared/redis/redis.service';

/**
 * Relay outbox (AD-04): baca PENDING → publish ke Redis → tandai SENT.
 * Event gagal di-retry dengan backoff eksponensial, tidak pernah hilang diam-diam.
 */
@Injectable()
export class OutboxRelayJob {
  private readonly logger = new Logger(OutboxRelayJob.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    const events = await this.outbox.claimPending(100);
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      try {
        await this.redis.publish('sarko:events', {
          id: event.id,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          event_type: event.eventType,
          payload: event.payload,
        });
        await this.outbox.markSent(event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
        await this.outbox.markFailed(event.id, message, 1);
        this.logger.warn({ eventId: event.id, err: error }, 'Relay outbox gagal');
      }
    }

    this.logger.debug({ count: events.length }, 'Outbox event diproses');
  }
}
