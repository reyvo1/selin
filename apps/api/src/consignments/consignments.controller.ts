import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { ConsignmentsService } from './consignments.service';

@ApiTags('consignments')
@ApiBearerAuth()
@Controller('consignments')
export class ConsignmentsController {
  constructor(private readonly service: ConsignmentsService) {}

  @Get()
  @Permissions('sales.view')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('sales.manage')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.service.create(user, dto);
  }

  @Post(':id/settle')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'FINANCE')
  @Permissions('sales.manage')
  settle(
    @Param('id') id: string,
    @Body() dto: { amount: unknown },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.settle(user, id, dto?.amount);
  }
}