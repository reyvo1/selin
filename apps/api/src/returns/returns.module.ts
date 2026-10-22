import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { OperationsControlModule } from '../operations-control/operations-control.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorefrontCustomerModule } from '../storefront-customer/storefront-customer.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { StorefrontOrderReturnsController } from './storefront-order-returns.controller';
@Module({ imports: [PrismaModule, AccountingCoreModule, OperationsControlModule, StorefrontCustomerModule, InventoryModule], controllers: [ReturnsController, StorefrontOrderReturnsController], providers: [ReturnsService], exports: [ReturnsService] })
export class ReturnsModule {}
