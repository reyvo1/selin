import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  ApproveOpeningBalanceBatchDto,
  CancelOpeningBalanceBatchDto,
  CreateOpeningBalanceBatchDto,
  PreviewOpeningBalanceBatchDto,
  RevalidateOpeningBalanceBatchDto,
  ReverseOpeningBalanceBatchDto,
  ReverseYearEndCloseDto,
  SettleOpeningLedgerDto,
  YearEndCloseDto,
} from './dto/opening-balance.dto';
import { OpeningBalanceService } from './opening-balance.service';

@ApiTags('opening-balance')
@ApiBearerAuth()
@Controller('accounting/opening-balance')
export class OpeningBalanceController {
  constructor(private readonly opening: OpeningBalanceService) {}

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'AUDITOR') @Permissions('accounting.opening.view') @Get('batches')
  list(@CurrentUser() user: AuthUser, @Query('type') type?: string, @Query('status') status?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.opening.list(user, { type, status, limit, cursor });
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'AUDITOR') @Permissions('accounting.opening.view') @Get('batches/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.opening.get(user, id);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'AUDITOR') @Permissions('accounting.opening.view') @Get('batches/:id/rows')
  rows(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('status') status?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.opening.rows(user, id, { status, limit, cursor });
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.import') @Post('batches/preview')
  preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewOpeningBalanceBatchDto) {
    return this.opening.preview(user, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.import') @Post('batches')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOpeningBalanceBatchDto) {
    return this.opening.create(user, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.import') @Post('batches/:id/revalidate')
  revalidate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RevalidateOpeningBalanceBatchDto = {}) {
    return this.opening.revalidate(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.import') @Post('batches/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.opening.submit(user, id);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.approve') @Post('batches/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApproveOpeningBalanceBatchDto = {}) {
    return this.opening.approve(user, id, dto.note);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.post') @Post('batches/:id/post')
  post(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.opening.post(user, id);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.reverse') @Post('batches/:id/reverse')
  reverse(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReverseOpeningBalanceBatchDto = {} as ReverseOpeningBalanceBatchDto) {
    return this.opening.reverse(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.import') @Post('batches/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOpeningBalanceBatchDto) {
    return this.opening.cancel(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.post') @Post('ledger/settle')
  settle(@CurrentUser() user: AuthUser, @Body() dto: SettleOpeningLedgerDto) {
    return this.opening.settleOpeningLedger(user, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE', 'AUDITOR') @Permissions('accounting.opening.view') @Get('cutover')
  cutoverStatus(@CurrentUser() user: AuthUser) {
    return this.opening.getCutoverStatus(user);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.post') @Post('cutover')
  cutover(@CurrentUser() user: AuthUser) {
    return this.opening.cutoverGate(user);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.post') @Post('year-end')
  yearEndClose(@CurrentUser() user: AuthUser, @Body() dto: YearEndCloseDto) {
    return this.opening.yearEndClose(user, dto);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'FINANCE') @Permissions('accounting.opening.reverse') @Post('year-end/reverse')
  reverseYearEndClose(@CurrentUser() user: AuthUser, @Body() dto: ReverseYearEndCloseDto = {}) {
    return this.opening.reverseYearEndClose(user, dto);
  }
}
