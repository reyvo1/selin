import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';

@Module({
  imports: [PrismaModule, AccountingCoreModule],
  controllers: [ChequesController],
  providers: [ChequesService],
})
export class ChequesModule {}
export { ChequesModule as ChequeModule };
