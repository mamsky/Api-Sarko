import { Module } from '@nestjs/common';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductRepository } from './repositories/product.repository';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, ProductRepository],
  exports: [CatalogService, ProductRepository],
})
export class CatalogModule {}
