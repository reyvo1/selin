import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCostingService } from './costing.service';
import { InventoryCostingPolicyService } from './costing-policy.service';
import { InventoryCostingController } from './costing.controller';
import { CrossBranchStockController } from './cross-branch-stock.controller';
// CrossBranchStockController injects PrismaService directly, so PrismaModule is imported here —
// InventoryService reaches the database through its own module, which does not re-export Prisma.
@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, CrossBranchStockController, InventoryCostingController],
  providers: [InventoryService, InventoryCostingService, InventoryCostingPolicyService],
  exports: [InventoryCostingService],
})
export class InventoryModule {}
