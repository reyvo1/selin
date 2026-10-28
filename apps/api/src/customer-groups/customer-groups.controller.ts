import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { CustomerGroupsService } from './customer-groups.service';

@ApiTags('customer-groups')
@ApiBearerAuth()
@Controller('customer-groups')
export class CustomerGroupsController {
  constructor(private readonly customerGroups: CustomerGroupsService) {}

  @Get()
  @Permissions('customer.view')
  list(@CurrentUser() user: AuthUser) {
    return this.customerGroups.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('customer.manage')
  create(@Body() dto: { code: string; name: string; discountPct?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.customerGroups.create(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('customer.manage')
  update(@Param('id') id: string, @Body() dto: { code?: string; name?: string; discountPct?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.customerGroups.update(user, id, dto);
  }
}
