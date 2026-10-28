import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { InventoryCostingPolicyService } from './costing-policy.service';
import { InventoryCostingReportService } from './costing-report.service';
import { CreateCostingPolicyDto, CreateCostingRebuildDto } from './dto/costing.dto';
import { InventoryCostingRebuildService } from './costing-rebuild.service';

@ApiTags('inventory-costing') @ApiBearerAuth() @Controller('inventory/costing')
export class InventoryCostingController {
  constructor(
    private readonly policies: InventoryCostingPolicyService,
    private readonly reports: InventoryCostingReportService,
    private readonly rebuilds: InventoryCostingRebuildService,
  ) {}

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('policies')
  listPolicies(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    return this.policies.list(user, { limit, cursor, status, method });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.manage') @Post('policies')
  createPolicy(@Body() dto: CreateCostingPolicyDto, @CurrentUser() user: AuthUser) {
    return this.policies.create(user, dto);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.manage') @Post('policies/:id/activate')
  activatePolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.policies.activate(user, id);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('valuation')
  valuation(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId?: string, @Query('productId') productId?: string) {
    return this.policies.valuation(user, { warehouseId, productId });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('preview-issue')
  previewIssue(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('batchKey') batchKey?: string,
    @Query('occurredAt') occurredAt?: string,
    @Query('quantity') quantity?: string,
  ) {
    return this.policies.previewIssue(user, { warehouseId, productId, batchKey, occurredAt, quantity });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('valuation-layers')
  valuationByLayer(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reports.valuationByLayer(user, { warehouseId, productId });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('parallel-run')
  parallelRun(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.reports.parallelRun(user, { from, to, warehouseId });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('layers')
  layers(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('batchKey') batchKey?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.reports.layers(user, { warehouseId, productId, batchKey, status, limit, cursor });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('reconciliation')
  reconciliation(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
    @Query('onlyDifferences') onlyDifferences?: string,
  ) {
    return this.reports.reconciliation(user, { warehouseId, productId, limit, onlyDifferences });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.rebuild') @Post('rebuild')
  requestRebuild(@Body() dto: CreateCostingRebuildDto, @CurrentUser() user: AuthUser) {
    return this.rebuilds.request(user, dto);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('rebuild-runs')
  listRebuildRuns(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.rebuilds.list(user, { status, limit, cursor });
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','AUDITOR') @Permissions('inventory.costing.view') @Get('rebuild-runs/:id')
  getRebuildRun(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rebuilds.get(user, id);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.rebuild') @Post('rebuild-runs/:id/approve')
  approveRebuild(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rebuilds.approve(user, id);
  }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE') @Permissions('inventory.costing.rebuild') @Post('rebuild-runs/:id/resume')
  resumeRebuild(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rebuilds.resume(user, id);
  }
}
