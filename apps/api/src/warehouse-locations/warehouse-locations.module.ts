import { Module } from '@nestjs/common';
import { WarehouseLocationController } from './warehouse-locations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WarehouseLocationController],
})
export class WarehouseLocationModule {}
