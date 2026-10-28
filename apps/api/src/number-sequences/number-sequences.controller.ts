import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { NumberSequencesService } from './number-sequences.service';

@ApiTags('number-sequences')
@ApiBearerAuth()
@Controller('number-sequences')
export class NumberSequencesController {
  constructor(private readonly numberSequences: NumberSequencesService) {}

  @Get()
  @Permissions('platform.configure')
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.numberSequences.list(user, companyId, branchId, documentType);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  upsert(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.numberSequences.upsert(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.numberSequences.update(user, id, dto);
  }
}
