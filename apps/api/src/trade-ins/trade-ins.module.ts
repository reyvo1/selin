import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { TradeInsController } from './trade-ins.controller';
import { TradeInsService } from './trade-ins.service';

@Module({
  imports: [PrismaModule, AccountingCoreModule],
  controllers: [TradeInsController],
  providers: [TradeInsService],
  exports: [TradeInsService],
})
export class TradeInsModule {}
