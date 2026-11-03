import { Global, Module } from '@nestjs/common';

import { OutboxService } from './outbox.service';

/** Global agar setiap modul bisa menulis outbox tanpa import berulang. */
@Global()
@Module({
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
