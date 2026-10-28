import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpeningBalanceController } from './opening-balance.controller';
import { OpeningBalanceService } from './opening-balance.service';

@Module({ imports: [PrismaModule, AccountingCoreModule, InventoryModule], controllers: [OpeningBalanceController], providers: [OpeningBalanceService], exports: [OpeningBalanceService] })
export class OpeningBalanceModule {}
