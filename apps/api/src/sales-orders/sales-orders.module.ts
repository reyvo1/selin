import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesOrdersService } from './sales-orders.service';
import { SalesOrdersController } from './sales-orders.controller';

@Module({ imports: [PrismaModule], controllers: [SalesOrdersController], providers: [SalesOrdersService], exports: [SalesOrdersService] })
export class SalesOrdersModule {}
