import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerARSettlementController } from './customer-ar-settlement.controller';
import { CustomerARSettlementService } from './customer-ar-settlement.service';

@Module({
  imports: [PrismaModule, AccountingCoreModule],
  controllers: [CustomerARSettlementController],
  providers: [CustomerARSettlementService],
})
export class CustomerARSettlementModule {}
