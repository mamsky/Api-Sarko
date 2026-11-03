import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { ProductRepository } from '../catalog/repositories/product.repository';
import { OrderingController } from './ordering.controller';
import { OrderingService } from './ordering.service';
import { OrderNumberService } from './order-number.service';
import { OrderRepository } from './repositories/order.repository';
import { OutletTaxRepository } from './repositories/outlet-tax.repository';

@Module({
  imports: [InventoryModule],
  controllers: [OrderingController],
  providers: [
    OrderingService,
    OrderRepository,
    OutletTaxRepository,
    OrderNumberService,
    ProductRepository,
  ],
  exports: [OrderingService, OrderRepository, OrderNumberService],
})
export class OrderingModule {}
