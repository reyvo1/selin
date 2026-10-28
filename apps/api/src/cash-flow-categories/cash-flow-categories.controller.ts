import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { CashFlowCategoriesService } from './cash-flow-categories.service';

@ApiTags('cash-flow-categories')
@ApiBearerAuth()
@Controller('cash-flow-categories')
export class CashFlowCategoriesController {
  constructor(private readonly cashFlowCategories: CashFlowCategoriesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER', 'AUDITOR')
  @Permissions('finance.view')
  list(@CurrentUser() user: AuthUser) {
    return this.cashFlowCategories.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  create(@Body() dto: { code: string; name: string; kind?: string }, @CurrentUser() user: AuthUser) {
    return this.cashFlowCategories.create(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  update(@Param('id') id: string, @Body() dto: { name?: string; kind?: string; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.cashFlowCategories.update(user, id, dto);
  }
}