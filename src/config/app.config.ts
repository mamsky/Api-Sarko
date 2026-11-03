import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

/**
 * Akses ter-type ke environment. Modul lain menyuntik kelas ini,
 * bukan `ConfigService` mentah, supaya nama env tidak tersebar sebagai string.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): string {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  get paymentWebhookSecret(): string {
    return this.config.get('PAYMENT_GATEWAY_WEBHOOK_SECRET', { infer: true });
  }

  get paymentWebhookToleranceSeconds(): number {
    return this.config.get('PAYMENT_GATEWAY_WEBHOOK_TOLERANCE_SECONDS', { infer: true });
  }

  get businessTimezone(): string {
    return this.config.get('BUSINESS_TIMEZONE', { infer: true });
  }

  get businessCutoffHour(): number {
    return this.config.get('BUSINESS_CUTOFF_HOUR', { infer: true });
  }

  get pinMaxAttempts(): number {
    return this.config.get('PIN_MAX_ATTEMPTS', { infer: true });
  }

  get pinLockMinutes(): number {
    return this.config.get('PIN_LOCK_MINUTES', { infer: true });
  }

  get deviceHeartbeatTimeoutSeconds(): number {
    return this.config.get('DEVICE_HEARTBEAT_TIMEOUT_SECONDS', { infer: true });
  }

  get loyaltyRupiahPerPoint(): number {
    return this.config.get('LOYALTY_RUPIAH_PER_POINT', { infer: true });
  }

  get appVersion(): string {
    return process.env.npm_package_version ?? '0.1.0';
  }
}
