import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ManufacturingController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';
import { WorkCentersService } from './work-centers.service';
import { ProductionRoutingsService } from './production-routings.service';

@Module({ imports: [PrismaModule, AccountingCoreModule, InventoryModule], controllers: [ManufacturingController], providers: [ManufacturingService, WorkCentersService, ProductionRoutingsService] })
export class ManufacturingModule {}
