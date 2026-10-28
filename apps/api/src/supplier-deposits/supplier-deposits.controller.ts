import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { SupplierDepositsService } from './supplier-deposits.service';

@ApiTags('supplier-deposits')
@ApiBearerAuth()
@Controller('supplier-deposits')
export class SupplierDepositsController {
  constructor(private readonly supplierDeposits: SupplierDepositsService) {}

  @Get()
  @Permissions('supplier.view')
  list(@CurrentUser() user: AuthUser, @Query('supplierId') supplierId?: string) {
    return this.supplierDeposits.list(user, supplierId);
  }

  @Get('supplier/:supplierId')
  @Permissions('supplier.view')
  listBySupplierPath(@CurrentUser() user: AuthUser, @Param('supplierId') supplierId: string) {
    return this.supplierDeposits.list(user, supplierId);
  }

  @Get(':supplierId')
  @Permissions('supplier.view')
  listBySupplierParam(@CurrentUser() user: AuthUser, @Param('supplierId') supplierId: string) {
    return this.supplierDeposits.list(user, supplierId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING', 'FINANCE', 'MANAGER')
  @Permissions('supplier.create')
  create(@Body() dto: { supplierId: string; amount: unknown }, @CurrentUser() user: AuthUser) {
    return this.supplierDeposits.create(user, dto);
  }

  @Post(':id/apply')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING', 'FINANCE', 'MANAGER')
  @Permissions('supplier.update')
  applyById(@Param('id') id: string, @Body() dto: { amount?: unknown } = {}, @CurrentUser() user: AuthUser) {
    return this.supplierDeposits.apply(user, id, dto);
  }
}