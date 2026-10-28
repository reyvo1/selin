import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransferFilesController } from './transfer-files.controller';
import { TransferFilesService } from './transfer-files.service';

@Module({
  imports: [PrismaModule],
  controllers: [TransferFilesController],
  providers: [TransferFilesService],
})
export class TransferFilesModule {}