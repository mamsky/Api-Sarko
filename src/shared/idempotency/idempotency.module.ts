import { Global, Module } from '@nestjs/common';

import { IdempotencyGuard } from './idempotency.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

/** Global: guard & interceptor didaftarkan sekali di `app.module.ts`. */
@Global()
@Module({
  providers: [IdempotencyService, IdempotencyGuard, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyGuard, IdempotencyInterceptor],
})
export class IdempotencyModule {}
