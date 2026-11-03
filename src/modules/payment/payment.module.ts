import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InventoryModule } from '../inventory/inventory.module';
import { OrderingModule } from '../ordering/ordering.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './repositories/payment.repository';

@Module({
  imports: [OrderingModule, InventoryModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentRepository,
    {
      provide: 'PAYMENT_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        loyaltyRupiahPerPoint: Number(config.get('LOYALTY_RUPIAH_PER_POINT', 1000)),
      }),
    },
  ],
  exports: [PaymentService, PaymentRepository],
})
export class PaymentModule {}
