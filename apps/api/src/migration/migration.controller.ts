import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { MigrationService } from './migration.service';
import { MigrationDryRunDto } from './dto/migration-dry-run.dto';

@ApiTags('migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post('dry-run')
  @Permissions('platform.configure')
  dryRun(@Body() dto: MigrationDryRunDto, @CurrentUser() user: AuthUser) {
    return this.migration.dryRun(dto);
  }

  @Post('preview')
  @Permissions('platform.configure')
  preview(@Body() dto: MigrationDryRunDto, @CurrentUser() user: AuthUser) {
    return this.migration.preview(user, dto);
  }

  @Post('cutover-check')
  @Permissions('platform.configure')
  cutoverCheck(@Body() dto: MigrationDryRunDto, @CurrentUser() user: AuthUser) {
    return this.migration.cutoverCheck(user, dto);
  }

  @Post('cutover')
  @Permissions('platform.configure')
  cutover(@Body() dto: MigrationDryRunDto, @CurrentUser() user: AuthUser) {
    return this.migration.cutover(user, dto);
  }

  @Post('rollback-check')
  @Permissions('platform.configure')
  rollbackCheck(@Body() dto: MigrationDryRunDto, @CurrentUser() user: AuthUser) {
    return this.migration.rollbackCheck(user, dto);
  }
}