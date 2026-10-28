import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { CommissionsService } from './commissions.service';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('rules')
  @Permissions('manufacturing.view')
  rules(@CurrentUser() user: AuthUser) {
    return this.commissions.listRules(user);
  }

  @Post('rules')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('manufacturing.manage')
  createRule(@Body() dto: { name: string; basis?: string; rate: number }, @CurrentUser() user: AuthUser) {
    return this.commissions.createRule(user, dto);
  }

  @Post('rules/:id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('manufacturing.manage')
  updateRule(@Param('id') id: string, @Body() dto: { name?: string; basis?: string; rate?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.commissions.updateRule(user, id, dto);
  }

  @Get('payouts')
  @Permissions('manufacturing.view')
  payouts(@CurrentUser() user: AuthUser) {
    return this.commissions.listPayouts(user);
  }

  @Post('payouts/compute')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('manufacturing.manage')
  computePayout(@Body() dto: { periodStart: string; periodEnd: string; salespersonId?: string }, @CurrentUser() user: AuthUser) {
    return this.commissions.computePayout(user, dto);
  }
}