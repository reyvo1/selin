import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashFlowCategoriesController } from './cash-flow-categories.controller';
import { CashFlowCategoriesService } from './cash-flow-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashFlowCategoriesController],
  providers: [CashFlowCategoriesService],
})
export class CashFlowCategoriesModule {}