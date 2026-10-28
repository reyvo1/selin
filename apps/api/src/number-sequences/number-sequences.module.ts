import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberSequencesController } from './number-sequences.controller';
import { NumberSequencesService } from './number-sequences.service';

@Module({
  imports: [PrismaModule],
  controllers: [NumberSequencesController],
  providers: [NumberSequencesService],
})
export class NumberSequencesModule {}
