import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { PrintersService } from './printers.service';

@ApiTags('printers')
@ApiBearerAuth()
@Controller('printers')
export class PrintersController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  @Permissions('platform.configure')
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.printers.listPrinters(user, companyId, branchId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.printers.createPrinter(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.printers.updatePrinter(user, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.printers.deletePrinter(user, id);
  }

  @Get('default')
  @Permissions('platform.configure')
  defaultPrinter(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.printers.getDefaultPrinter(user, branchId);
  }
}
