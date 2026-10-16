import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders') @ApiBearerAuth() @Controller('purchase-orders')
  export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Roles('SUPER_ADMIN','OWNER','ADMIN','PURCHASING','WAREHOUSE','FINANCE')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.orders.list(user, limit, cursor);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','PURCHASING','WAREHOUSE','FINANCE')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','PURCHASING')
  @Post()
  @Permissions('purchase.create')
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','PURCHASING')
  @Post(':id/cancel')
  @Permissions('purchase.cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { reason?: string } | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.cancel(id, user, body?.reason, idempotencyKey);
  }
}
