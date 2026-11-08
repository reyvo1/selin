import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { CommissionReportController } from './commission-report.controller';

@Module({ imports: [PrismaModule], controllers: [CommissionsController, CommissionReportController], providers: [CommissionsService], exports: [CommissionsService] })
export class CommissionsModule {}
