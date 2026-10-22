import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ManufacturingController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';

@Module({ imports: [PrismaModule, AccountingCoreModule, InventoryModule], controllers: [ManufacturingController], providers: [ManufacturingService] })
export class ManufacturingModule {}
