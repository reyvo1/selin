import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { SupplierPricesService } from './supplier-prices.service';

@ApiTags('supplier-prices')
@ApiBearerAuth()
@Controller('supplier-prices')
export class SupplierPricesController {
  constructor(private readonly supplierPrices: SupplierPricesService) {}

  @Get()
  @Permissions('supplier.view')
  list(@CurrentUser() user: AuthUser, @Query('supplierId') supplierId?: string, @Query('productId') productId?: string) {
    return this.supplierPrices.list(user, supplierId, productId);
  }

  @Get('history')
  @Permissions('supplier.view')
  history(@CurrentUser() user: AuthUser, @Query('supplierId') supplierId?: string, @Query('productId') productId?: string) {
    return this.supplierPrices.history(user, supplierId, productId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING')
  @Permissions('supplier.create')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.supplierPrices.create(user, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING')
  @Permissions('supplier.update')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.supplierPrices.update(user, id, dto);
  }
}
