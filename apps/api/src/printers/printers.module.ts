import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintersController } from './printers.controller';
import { PrintJobsController } from './print-jobs.controller';
import { PrintersService } from './printers.service';

@Module({
  imports: [PrismaModule],
  controllers: [PrintersController, PrintJobsController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
