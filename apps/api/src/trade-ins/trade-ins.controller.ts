import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { TradeInsService, CompleteTradeInDto } from './trade-ins.service';
import { CreateTradeInDto } from './dto/create-trade-in.dto';

@ApiTags('trade-ins')
@ApiBearerAuth()
@Controller('trade-ins')
export class TradeInsController {
  constructor(private readonly service: TradeInsService) {}

  @Get()
  @Permissions('sales.view')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Permissions('sales.manage')
  create(@Body() dto: CreateTradeInDto, @CurrentUser() user: AuthUser) {
    return this.service.create(user, dto);
  }

  @Post(':id/complete')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Permissions('sales.manage')
  complete(@Param('id') id: string, @Body() dto: CompleteTradeInDto, @CurrentUser() user: AuthUser) {
    return this.service.complete(id, dto, user);
  }
}
