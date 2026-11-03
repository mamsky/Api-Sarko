import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../modules/identity/identity.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { PaymentModule } from '../modules/payment/payment.module';
import { OutboxModule } from '../shared/outbox/outbox.module';
import { RedisModule } from '../shared/redis/redis.service';
import { envSchema } from '../config/env.schema';
import { DeviceHeartbeatMonitorJob } from './device-heartbeat-monitor.job';
import { OutboxRelayJob } from './outbox-relay.job';
import { PaymentReconcileJob } from './payment-reconcile.job';
import { StockRecalcJob } from './stock-recalc.job';

/**
 * Modul worker: proses terpisah dari API (container sendiri, plan §2.1).
 * Tidak ada controller HTTP — hanya job terjadwal.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: (raw) => envSchema.parse(raw) }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    OutboxModule,
    IdentityModule,
    InventoryModule,
    PaymentModule,
    NotificationModule,
  ],
  providers: [OutboxRelayJob, PaymentReconcileJob, StockRecalcJob, DeviceHeartbeatMonitorJob],
})
export class WorkerModule {}
