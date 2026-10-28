import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { GeneralSettingsService } from './general-settings.service';

@ApiTags('general-settings')
@ApiBearerAuth()
@Controller('general-settings')
export class GeneralSettingsController {
  constructor(private readonly generalSettings: GeneralSettingsService) {}

  @Get()
  @Permissions('platform.configure')
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('namespace') namespace?: string,
  ) {
    return this.generalSettings.list(user, companyId, namespace);
  }

  @Get(':key')
  @Permissions('platform.configure')
  get(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Query('namespace') namespace?: string,
  ) {
    return this.generalSettings.get(user, key, namespace);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  upsert(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.generalSettings.upsert(user, dto);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('platform.configure')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.generalSettings.update(user, id, dto);
  }
}
