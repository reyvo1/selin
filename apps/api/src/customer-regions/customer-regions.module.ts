import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerRegionsController } from './customer-regions.controller';
import { CustomerRegionsService } from './customer-regions.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerRegionsController],
  providers: [CustomerRegionsService],
})
export class CustomerRegionsModule {}
