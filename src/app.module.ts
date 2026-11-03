import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { AppConfig } from './config/app.config';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';
import { JwtAuthGuard } from './modules/identity/jwt-auth.guard';
import { RolesGuard } from './modules/identity/roles.guard';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrderingModule } from './modules/ordering/ordering.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PromotionModule } from './modules/promotion/promotion.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { SyncModule } from './modules/sync/sync.module';
import { IdempotencyGuard } from './shared/idempotency/idempotency.guard';
import { IdempotencyInterceptor } from './shared/idempotency/idempotency.interceptor';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';
import { OutboxModule } from './shared/outbox/outbox.module';
import { RedisModule } from './shared/redis/redis.service';

function hasPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    ClsModule.forRoot({ global: true, middleware: { mount: true, generateId: true } }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // `pino-pretty` adalah devDependency opsional; bila tidak terpasang
        // (mis. image produksi minimal) logger tetap jalan dengan JSON mentah.
        transport: hasPinoPretty() ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        redact: ['req.headers.authorization', 'req.headers["idempotency-key"]'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    IdempotencyModule,
    OutboxModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
    InventoryModule,
    OrderingModule,
    PaymentModule,
    SyncModule,
    LoyaltyModule,
    PromotionModule,
    ReportingModule,
    NotificationModule,
  ],
  providers: [
    AppConfig,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: IdempotencyGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  exports: [AppConfig],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Middleware tambahan (mis. raw body capture) dipasang di main.ts
    // karena butuh opsi NestFactory, bukan middleware global.
  }
}
