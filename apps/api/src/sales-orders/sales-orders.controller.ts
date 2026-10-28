import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { SalesOrdersService } from './sales-orders.service';

@ApiTags('sales-orders')
@ApiBearerAuth()
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly service: SalesOrdersService) {}

  @Get()
  @Permissions('sales.view')
  list(@CurrentUser() user: AuthUser) { return this.service.list(user); }

  @Get(':id')
  @Permissions('sales.view')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.service.get(user, id); }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST')
  @Permissions('sales.manage')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) { return this.service.create(user, dto); }

  @Post(':id/settle')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'FINANCE')
  @Permissions('sales.manage')
  settle(@Param('id') id: string, @Body() dto: { amount: number; method: string }, @CurrentUser() user: AuthUser) { return this.service.settle(user, id, dto.amount, dto.method); }
}
