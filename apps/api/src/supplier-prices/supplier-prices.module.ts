import { Module } from '@nestjs/common';
import { SupplierPricesController } from './supplier-prices.controller';
import { SupplierPricesService } from './supplier-prices.service';

@Module({
  controllers: [SupplierPricesController],
  providers: [SupplierPricesService],
  exports: [SupplierPricesService],
})
export class SupplierPricesModule {}
