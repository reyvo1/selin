import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { ChequesService } from './cheques.service';

@ApiTags('cheques')
@ApiBearerAuth()
@Controller(['cheques', 'cheque'])
export class ChequesController {
  constructor(private readonly cheques: ChequesService) {}

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER', 'AUDITOR')
  @Permissions('finance.view')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('direction') direction?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.cheques.list(user, status, direction, limit, cursor);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  @Post()
  create(
    @Body()
    dto: {
      direction: string;
      number: string;
      partyType: string;
      partyId: string;
      amount: unknown;
      dueDate?: string | Date | null;
      status?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.cheques.create(user, dto);
  }

  private transition(
    id: string,
    dto: { status?: string; toStatus?: string; newStatus?: string; targetStatus?: string; amount?: unknown; dueDate?: string | Date | null; reason?: string },
    user: AuthUser,
  ) {
    return this.cheques.transitionStatus(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  @Post(':id/transition')
  transitionByTransition(
    @Param('id') id: string,
    @Body() dto: { status?: string; toStatus?: string; newStatus?: string; targetStatus?: string; amount?: unknown; dueDate?: string | Date | null; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.transition(id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  @Post(':id/status')
  transitionByStatus(
    @Param('id') id: string,
    @Body() dto: { status?: string; toStatus?: string; newStatus?: string; targetStatus?: string; amount?: unknown; dueDate?: string | Date | null; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.transition(id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'ADMIN', 'MANAGER')
  @Permissions('finance.create')
  @Post(':id/transition-status')
  transitionByTransitionStatus(
    @Param('id') id: string,
    @Body() dto: { status?: string; toStatus?: string; newStatus?: string; targetStatus?: string; amount?: unknown; dueDate?: string | Date | null; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.transition(id, dto, user);
  }
}
export { ChequesController as ChequeController };
