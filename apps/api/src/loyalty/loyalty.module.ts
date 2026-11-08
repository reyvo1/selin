import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LoyaltyController],
})
export class LoyaltyModule {}
