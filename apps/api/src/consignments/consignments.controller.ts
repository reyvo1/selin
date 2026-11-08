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

  @Get(':id')
  @Permissions('sales.view')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(user, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('sales.manage')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.service.create(user, dto);
  }

  /**
   * J05: state machine konsinyasi (DRAFT → SHIPPED → PARTIALLY_SOLD → SETTLED / RETURNED).
   */
  @Post(':id/advance')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('sales.manage')
  advance(@Param('id') id: string, @Body() dto: { status: 'SHIPPED' | 'PARTIALLY_SOLD' | 'SETTLED' | 'RETURNED' }, @CurrentUser() user: AuthUser) {
    return this.service.advance(user, id, dto.status);
  }

  /**
   * J06: tagihan konsinyasi (read-only, hitung nilai penjualan + outstanding).
   */
  @Get(':id/billing')
  @Permissions('sales.view')
  billing(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.billing(user, id);
  }

  /**
   * J07: settlement konsinyasi (bayar supplier). Wajib operationKey untuk idempotensi.
   */
  @Post(':id/settle')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'FINANCE')
  @Permissions('finance.post')
  settle(
    @Param('id') id: string,
    @Body() dto: { amount: unknown; operationKey: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.settle(user, id, dto);
  }

  /**
   * J04: retur konsinyasi (kembali ke supplier).
   */
  @Post(':id/return')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('sales.manage')
  returnItems(
    @Param('id') id: string,
    @Body() dto: { items: Array<{ productId: string; quantity: number; reason?: string }> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.returnItems(user, id, dto);
  }
}
