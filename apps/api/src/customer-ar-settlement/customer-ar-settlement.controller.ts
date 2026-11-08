import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { CustomerARSettlementService } from './customer-ar-settlement.service';

@ApiTags('customer-ar-settlement')
@ApiBearerAuth()
@Controller('customer-ar-settlement')
export class CustomerARSettlementController {
  constructor(private readonly service: CustomerARSettlementService) {}

  @Get('aging')
  @Permissions('finance.view')
  async getAging(@CurrentUser() user: AuthUser, @Query('customerId') customerId?: string) {
    return this.service.aging(user, customerId);
  }

  @Post('settle')
  @Permissions('finance.post')
  async settle(
    @CurrentUser() user: AuthUser,
    @Body() dto: { invoiceId: string; amount: number; debitAccountCode?: string; note?: string; operationKey: string },
  ) {
    if (!dto?.operationKey?.trim()) {
      throw new BadRequestException('operationKey wajib untuk pelunasan piutang (stabil untuk retry aman).');
    }
    return this.service.settle(user, { ...dto, operationKey: dto.operationKey.trim() });
  }
}
