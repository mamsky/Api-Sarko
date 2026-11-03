import { Module } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';

@Module({
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
