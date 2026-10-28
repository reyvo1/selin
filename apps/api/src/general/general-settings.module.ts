import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeneralSettingsController } from './general-settings.controller';
import { GeneralSettingsService } from './general-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [GeneralSettingsController],
  providers: [GeneralSettingsService],
})
export class GeneralSettingsModule {}
