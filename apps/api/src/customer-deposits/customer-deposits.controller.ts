import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { CustomerDepositsService } from './customer-deposits.service';

@ApiTags('customer-deposits')
@ApiBearerAuth()
@Controller('customer-deposits')
export class CustomerDepositsController {
  constructor(private readonly customerDeposits: CustomerDepositsService) {}

  @Get()
  @Permissions('customer.view')
  list(@CurrentUser() user: AuthUser, @Query('customerId') customerId?: string) {
    return this.customerDeposits.list(user, customerId);
  }

  @Get('customer/:customerId')
  @Permissions('customer.view')
  listByCustomerPath(@CurrentUser() user: AuthUser, @Param('customerId') customerId: string) {
    return this.customerDeposits.list(user, customerId);
  }

  @Get(':customerId')
  @Permissions('customer.view')
  listByCustomerParam(@CurrentUser() user: AuthUser, @Param('customerId') customerId: string) {
    return this.customerDeposits.list(user, customerId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Permissions('customer.manage')
  create(@Body() dto: { customerId: string; amount: unknown }, @CurrentUser() user: AuthUser) {
    return this.customerDeposits.create(user, dto);
  }

  @Post('apply')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Permissions('customer.manage')
  applyByBody(@Body() dto: { id?: string; depositId?: string; customerId?: string; amount?: unknown }, @CurrentUser() user: AuthUser) {
    return this.customerDeposits.apply(user, dto);
  }

  @Post(':id/apply')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Permissions('customer.manage')
  applyById(@Param('id') id: string, @Body() dto: { amount?: unknown } = {}, @CurrentUser() user: AuthUser) {
    return this.customerDeposits.apply(user, id, dto);
  }
}