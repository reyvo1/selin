import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { CustomerRegionsService } from './customer-regions.service';

@ApiTags('customer-regions')
@ApiBearerAuth()
@Controller('customer-regions')
export class CustomerRegionsController {
  constructor(private readonly customerRegions: CustomerRegionsService) {}

  @Get()
  @Permissions('customer.view')
  list(@CurrentUser() user: AuthUser) {
    return this.customerRegions.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('customer.manage')
  create(@Body() dto: { code: string; name: string; discountPct?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.customerRegions.create(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('customer.manage')
  update(@Param('id') id: string, @Body() dto: { code?: string; name?: string; discountPct?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.customerRegions.update(user, id, dto);
  }
}
