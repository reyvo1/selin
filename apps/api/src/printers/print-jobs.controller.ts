import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { PrintersService } from './printers.service';

@ApiTags('print-jobs')
@ApiBearerAuth()
@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  @Permissions('platform.configure')
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('printerId') printerId?: string,
  ) {
    return this.printers.listJobs(user, companyId, branchId, status, printerId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.printers.createJob(user, dto);
  }

  @Post(':id/status')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  status(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.printers.updateJobStatus(user, id, dto);
  }

  @Post(':id/retry')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  retry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.printers.retryJob(user, id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.printers.deleteJob(user, id);
  }
}
