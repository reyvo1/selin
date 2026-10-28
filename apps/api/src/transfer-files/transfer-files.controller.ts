import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { TransferFilesService } from './transfer-files.service';

@ApiTags('transfer-files')
@ApiBearerAuth()
@Controller('transfer-files')
export class TransferFilesController {
  constructor(private readonly transferFiles: TransferFilesService) {}

  @Get()
  @Permissions('manufacturing.view')
  list(@CurrentUser() user: AuthUser) {
    return this.transferFiles.list(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('manufacturing.manage')
  create(@Body() dto: { direction: string; fileName: string; status?: string }, @CurrentUser() user: AuthUser) {
    return this.transferFiles.create(user, dto);
  }
}