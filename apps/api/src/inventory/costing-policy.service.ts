import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CostingPolicyStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostingPolicyDto } from './dto/costing.dto';
import { InventoryCostingService } from './costing.service';

type TenantScope = { companyId: string; branchId: string };
type CostingPolicyQuery = { limit?: string; cursor?: string; status?: string; method?: string };
type CostingValuationQuery = { warehouseId?: string; productId?: string };

const STATUSES: CostingPolicyStatus[] = ['DRAFT', 'ACTIVE', 'RETIRED'];
const METHODS = ['MOVING_AVERAGE', 'FIFO', 'LIFO'] as const;
type CostingMethod = (typeof METHODS)[number];

@Injectable()
export class InventoryCostingPolicyService {
  constructor(private readonly prisma: PrismaService, private readonly costing: InventoryCostingService = new InventoryCostingService()) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Pengguna belum memiliki company dan branch yang valid.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private limit(value?: string): number {
    const parsed = Number(value ?? 50);
    if (!Number.isFinite(parsed) || parsed < 1) return 50;
    return Math.min(Math.floor(parsed), 100);
  }

  async list(user: AuthUser, query: CostingPolicyQuery) {
    const scope = this.requireTenantScope(user);
    if (query.status && !STATUSES.includes(query.status as CostingPolicyStatus)) {
      throw new BadRequestException({ code: 'COSTING_POLICY_STATUS_INVALID', message: 'Status policy costing tidak valid.' });
    }
    if (query.method && !METHODS.includes(query.method as CostingMethod)) {
      throw new BadRequestException({ code: 'COSTING_METHOD_UNSUPPORTED', message: 'Metode costing tidak valid.' });
    }
    const take = this.limit(query.limit);
    const rows = await this.prisma.costingPolicy.findMany({
      where: {
        companyId: scope.companyId,
        OR: [{ branchId: scope.branchId }, { branchId: null }],
        ...(query.status ? { status: query.status as CostingPolicyStatus } : {}),
        ...(query.method ? { method: query.method as CostingMethod } : {}),
      },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    const items = rows.slice(0, take);
    return { items, nextCursor: rows.length > take ? rows[take].id : null };
  }

  async create(user: AuthUser, dto: CreateCostingPolicyDto) {
    const scope = this.requireTenantScope(user);
    if (dto.branchId && dto.branchId !== scope.branchId) {
      throw new ForbiddenException({ code: 'TENANT_ACCESS_DENIED', message: 'Policy hanya boleh dibuat untuk branch pada token.' });
    }
    if (!METHODS.includes(dto.method)) {
      throw new BadRequestException({ code: 'COSTING_METHOD_UNSUPPORTED', message: 'Metode costing tidak valid.' });
    }
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException({ code: 'COSTING_POLICY_EFFECTIVE_INVALID', message: 'effectiveFrom bukan tanggal yang valid.' });
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: scope.branchId, companyId: scope.companyId }, select: { id: true } });
    if (!branch) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Branch pada token tidak ditemukan pada company.' });
    }
    const scopeKey = `branch:${scope.branchId}`;
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.costingPolicy.aggregate({ where: { companyId: scope.companyId, scopeKey }, _max: { version: true } });
      const version = (latest._max.version ?? 0) + 1;
      const policy = await tx.costingPolicy.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          scopeKey,
          method: dto.method,
          mode: dto.mode,
          status: 'DRAFT',
          version,
          effectiveFrom,
        },
      });
      await tx.auditLog.create({ data: {
        companyId: scope.companyId, userId: user.sub, action: 'COSTING_POLICY_CREATED', entityType: 'CostingPolicy', entityId: policy.id,
        payload: { branchId: scope.branchId, method: dto.method, mode: dto.mode, effectiveFrom: effectiveFrom.toISOString(), version },
      } });
      return policy;
    });
  }

  async activate(user: AuthUser, id: string) {
    const scope = this.requireTenantScope(user);
    const policy = await this.prisma.costingPolicy.findFirst({ where: { id, companyId: scope.companyId } });
    if (!policy || (policy.branchId && policy.branchId !== scope.branchId)) {
      throw new NotFoundException({ code: 'COSTING_POLICY_NOT_FOUND', message: 'Policy costing tidak ditemukan pada tenant pengguna.' });
    }
    if (!policy.branchId && !user.roles.some((role) => role === 'OWNER' || role === 'SUPER_ADMIN')) {
      throw new ForbiddenException({ code: 'TENANT_ACCESS_DENIED', message: 'Policy company-wide hanya boleh diaktifkan OWNER atau SUPER_ADMIN.' });
    }
    if (policy.status !== 'DRAFT') {
      throw new ConflictException({ code: 'COSTING_POLICY_NOT_DRAFT', message: 'Hanya policy DRAFT yang dapat diaktifkan.' });
    }
    const creator = await this.prisma.auditLog.findFirst({
      where: { companyId: scope.companyId, action: 'COSTING_POLICY_CREATED', entityType: 'CostingPolicy', entityId: policy.id },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!creator?.userId) {
      throw new ConflictException({ code: 'COSTING_POLICY_MAKER_MISSING', message: 'Jejak pembuat policy tidak ditemukan; policy tidak dapat diaktifkan.' });
    }
    if (creator.userId === user.sub) {
      throw new ForbiddenException({ code: 'COSTING_POLICY_MAKER_CHECKER', message: 'Aktivasi policy membutuhkan approver yang berbeda dari pembuat policy.' });
    }
    if (policy.effectiveFrom.getTime() < Date.now() - 60_000) {
      throw new BadRequestException({ code: 'COSTING_POLICY_BACKDATED', message: 'Policy dengan effectiveFrom di masa lalu tidak boleh diaktifkan tanpa rebuild/backfill.' });
    }
    return this.prisma.$transaction(async (tx) => {
      const conflictingEvent = await tx.inventoryCostEvent.findFirst({
        where: {
          companyId: scope.companyId,
          ...(policy.branchId ? { branchId: policy.branchId } : {}),
          method: { not: policy.method },
        },
        select: { id: true },
      });
      if (conflictingEvent) {
        throw new ConflictException({
          code: 'COSTING_METHOD_CUTOVER_REQUIRED',
          message: 'Metode lain sudah memiliki event costing pada branch ini. Jalankan rebuild/cutover sebelum mengaktifkan metode baru.',
        });
      }
      const changed = await tx.costingPolicy.updateMany({ where: { id: policy.id, status: 'DRAFT' }, data: { status: 'ACTIVE', approvedBy: user.sub, approvedAt: new Date() } });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'COSTING_POLICY_NOT_DRAFT', message: 'Policy sudah diubah oleh proses lain; muat ulang sebelum aktivasi.' });
      }
      const updated = await tx.costingPolicy.findUniqueOrThrow({ where: { id: policy.id } });
      await tx.auditLog.create({ data: {
        companyId: scope.companyId, userId: user.sub, action: 'COSTING_POLICY_ACTIVATED', entityType: 'CostingPolicy', entityId: policy.id,
        payload: { branchId: policy.branchId, method: policy.method, mode: policy.mode, effectiveFrom: policy.effectiveFrom.toISOString(), version: policy.version, makerUserId: creator.userId },
      } });
      return updated;
    });
  }

  private async activeMethod(scope: TenantScope): Promise<CostingMethod> {
    const now = new Date();
    const branchPolicy = await this.prisma.costingPolicy.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, status: 'ACTIVE', effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true },
    });
    const policy = branchPolicy ?? await this.prisma.costingPolicy.findFirst({
      where: { companyId: scope.companyId, branchId: null, status: 'ACTIVE', effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true },
    });
    return (policy?.method ?? 'MOVING_AVERAGE') as CostingMethod;
  }

  async valuation(user: AuthUser, query: CostingValuationQuery) {
    const scope = this.requireTenantScope(user);
    if (query.warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: query.warehouseId, branchId: scope.branchId, branch: { companyId: scope.companyId } },
        select: { id: true },
      });
      if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'Gudang tidak ditemukan pada tenant pengguna.' });
    }
    const method = await this.activeMethod(scope);
    const where: Prisma.InventoryCostStateWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      method,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const groups = await this.prisma.inventoryCostState.groupBy({
      by: ['warehouseId'],
      where,
      _sum: { quantity: true, value: true },
      orderBy: { warehouseId: 'asc' },
    });
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: groups.map((group) => group.warehouseId) } },
      select: { id: true, code: true, name: true },
    });
    const byId = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    let quantity = 0;
    let value = new Prisma.Decimal(0);
    const byWarehouse = groups.map((group) => {
      const groupQuantity = group._sum.quantity ?? 0;
      const groupValue = group._sum.value ?? new Prisma.Decimal(0);
      quantity += groupQuantity;
      value = value.add(groupValue);
      const warehouse = byId.get(group.warehouseId);
      return { warehouseId: group.warehouseId, code: warehouse?.code ?? null, name: warehouse?.name ?? null, quantity: groupQuantity, value: groupValue.toFixed(2) };
    });
    return { asOf: new Date().toISOString(), method, totals: { quantity, value: value.toFixed(2) }, byWarehouse };
  }

  async previewIssue(user: AuthUser, query: { warehouseId?: string; productId?: string; batchKey?: string; occurredAt?: string; quantity?: string }) {
    const scope = this.requireTenantScope(user);
    if (!query.warehouseId || !query.productId) {
      throw new BadRequestException({ code: 'COSTING_SCOPE_REQUIRED', message: 'warehouseId dan productId wajib untuk preview costing.' });
    }
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: query.warehouseId, branchId: scope.branchId, branch: { companyId: scope.companyId } }, select: { id: true } });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'Gudang tidak ditemukan pada tenant pengguna.' });
    const product = await this.prisma.product.findFirst({ where: { id: query.productId, companyId: scope.companyId }, select: { id: true } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan pada tenant pengguna.' });
    const quantity = Number(query.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: 'COSTING_QUANTITY_INVALID', message: 'Quantity preview costing harus bilangan bulat positif.' });
    }
    const occurredAt = query.occurredAt ? new Date(query.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException({ code: 'COSTING_OCCURRED_AT_INVALID', message: 'occurredAt bukan tanggal yang valid.' });
    }
    const result = await this.prisma.$transaction((tx) => this.costing.previewIssue(tx, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      warehouseId: query.warehouseId!,
      productId: query.productId!,
      batchKey: query.batchKey,
    }, occurredAt, quantity));
    return {
      asOf: occurredAt.toISOString(),
      method: await this.activeMethod(scope),
      cost: result.cost.toFixed(2),
      unitCost: result.unitCost.toFixed(6),
      uncostedQuantity: result.uncostedQuantity,
    };
  }
}
