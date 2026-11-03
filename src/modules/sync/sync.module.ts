import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { OrderingModule } from '../ordering/ordering.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncRepository } from './repositories/sync.repository';

@Module({
  imports: [OrderingModule, InventoryModule],
  controllers: [SyncController],
  providers: [SyncService, SyncRepository],
  exports: [SyncService, SyncRepository],
})
export class SyncModule {}
