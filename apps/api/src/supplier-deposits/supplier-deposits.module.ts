import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierDepositsController } from './supplier-deposits.controller';
import { SupplierDepositsService } from './supplier-deposits.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierDepositsController],
  providers: [SupplierDepositsService],
  exports: [SupplierDepositsService],
})
export class SupplierDepositsModule {}