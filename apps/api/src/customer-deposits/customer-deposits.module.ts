import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerDepositsController } from './customer-deposits.controller';
import { CustomerDepositsService } from './customer-deposits.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerDepositsController],
  providers: [CustomerDepositsService],
  exports: [CustomerDepositsService],
})
export class CustomerDepositsModule {}