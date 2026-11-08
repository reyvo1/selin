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

  /**
   * F10: Import transaksi cabang dari payload JSON.
   * Idempoten via checksum; tidak memodifikasi stok/jurnal.
   */
  @Post('import')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER')
  @Permissions('manufacturing.manage')
  import(
    @Body()
    dto: {
      direction: 'INBOUND' | 'OUTBOUND';
      fileName: string;
      payload: { branchId: string; transactions: Array<{ type: string; refId: string; amount: number; timestamp: string }> };
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.transferFiles.import(user, dto);
  }

  /**
   * F09: Export transaksi cabang ke payload JSON untuk branch tujuan atau server pusat.
   */
  @Post('export')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('manufacturing.manage')
  export(@Body() dto: { direction: 'INBOUND' | 'OUTBOUND'; limit?: number }, @CurrentUser() user: AuthUser) {
    return this.transferFiles.export(user, dto);
  }
}
