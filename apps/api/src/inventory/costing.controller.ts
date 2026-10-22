import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { InventoryCostingPolicyService } from './costing-policy.service';
import { CreateCostingPolicyDto } from './dto/costing.dto';

@ApiTags('inventory-costing') @ApiBearerAuth() @Controller('inventory/costing')
export class InventoryCostingController {
  constructor(private readonly policies: InventoryCostingPolicyService) {}

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('policies')
  listPolicies(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    return this.policies.list(user, { limit, cursor, status, method });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.manage') @Post('policies')
  createPolicy(@Body() dto: CreateCostingPolicyDto, @CurrentUser() user: AuthUser) {
    return this.policies.create(user, dto);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.manage') @Post('policies/:id/activate')
  activatePolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.policies.activate(user, id);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('valuation')
  valuation(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId?: string, @Query('productId') productId?: string) {
    return this.policies.valuation(user, { warehouseId, productId });
  }
}
