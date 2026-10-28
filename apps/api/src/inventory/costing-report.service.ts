import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryCostLayerStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type TenantScope = { companyId: string; branchId: string };
type LayerQuery = { warehouseId?: string; productId?: string; batchKey?: string; status?: string; limit?: string; cursor?: string };
type ReconciliationQuery = { warehouseId?: string; productId?: string; limit?: string; onlyDifferences?: string };

const LAYER_STATUSES: InventoryCostLayerStatus[] = ['OPEN', 'CONSUMED', 'REVERSED'];
type CostingMethod = 'MOVING_AVERAGE' | 'FIFO' | 'LIFO';

@Injectable()
export class InventoryCostingReportService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Pengguna belum memiliki company dan branch yang valid.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private limit(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(Math.floor(parsed), max);
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

  private async assertWarehouse(scope: TenantScope, warehouseId?: string): Promise<void> {
    if (!warehouseId) return;
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'Gudang tidak ditemukan pada tenant pengguna.' });
  }

  private async assertProduct(scope: TenantScope, productId?: string): Promise<void> {
    if (!productId) return;
    const product = await this.prisma.product.findFirst({ where: { id: productId, companyId: scope.companyId }, select: { id: true } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan pada tenant pengguna.' });
  }

  async layers(user: AuthUser, query: LayerQuery) {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, query.warehouseId);
    await this.assertProduct(scope, query.productId);
    const method = await this.activeMethod(scope);
    const status = query.status ?? 'OPEN';
    if (!LAYER_STATUSES.includes(status as InventoryCostLayerStatus)) {
      throw new BadRequestException({ code: 'COSTING_LAYER_STATUS_INVALID', message: 'Status layer costing tidak valid.' });
    }
    const take = this.limit(query.limit, 50, 200);
    const rows = await this.prisma.inventoryCostLayer.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        method,
        status: status as InventoryCostLayerStatus,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.batchKey !== undefined ? { batchKey: query.batchKey } : {}),
      },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });
    const items = rows.slice(0, take).map((row) => ({
      ...row,
      unitCost: row.unitCost.toFixed(6),
      originalValue: row.originalValue.toFixed(2),
      remainingValue: row.remainingValue.toFixed(2),
    }));
    return { method, items, nextCursor: rows.length > take ? rows[take].id : null };
  }

  async reconciliation(user: AuthUser, query: ReconciliationQuery) {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, query.warehouseId);
    await this.assertProduct(scope, query.productId);
    const method = await this.activeMethod(scope);
    const take = this.limit(query.limit, 100, 200);
    const onlyDifferences = query.onlyDifferences === 'true';
    const stateWhere: Prisma.InventoryCostStateWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      method,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const inventoryWhere: Prisma.InventoryWhereInput = {
      warehouse: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const layerWhere: Prisma.InventoryCostLayerWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      method,
      status: 'OPEN',
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [stateGroups, inventoryGroups, layerGroups, inventoryAccount] = await Promise.all([
      this.prisma.inventoryCostState.groupBy({ by: ['warehouseId'], where: stateWhere, _sum: { quantity: true, value: true } }),
      this.prisma.inventory.groupBy({ by: ['warehouseId'], where: inventoryWhere, _sum: { quantity: true } }),
      this.prisma.inventoryCostLayer.groupBy({ by: ['warehouseId'], where: layerWhere, _sum: { remainingQty: true, remainingValue: true } }),
      this.prisma.account.findFirst({ where: { branchId: scope.branchId, code: '1301' }, select: { id: true, code: true, name: true } }),
    ]);
    const glSums = inventoryAccount
      ? await this.prisma.journalLine.aggregate({ where: { accountId: inventoryAccount.id }, _sum: { debit: true, credit: true } })
      : null;
    const glDebit = glSums?._sum.debit ?? new Prisma.Decimal(0);
    const glCredit = glSums?._sum.credit ?? new Prisma.Decimal(0);
    const glBalance = glDebit.minus(glCredit);
    const stateByWarehouse = new Map(stateGroups.map((row) => [row.warehouseId, row]));
    const inventoryByWarehouse = new Map(inventoryGroups.map((row) => [row.warehouseId, row]));
    const layerByWarehouse = new Map(layerGroups.map((row) => [row.warehouseId, row]));
    const warehouseIds = [...new Set([
      ...stateByWarehouse.keys(),
      ...inventoryByWarehouse.keys(),
      ...layerByWarehouse.keys(),
    ])].sort();
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true, code: true, name: true },
    });
    const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
    const totals = {
      stateQuantity: 0,
      inventoryQuantity: 0,
      quantityDifference: 0,
      stateValue: new Prisma.Decimal(0),
      layerRemainingValue: new Prisma.Decimal(0),
      layerApplicable: false,
    };
    const rows = warehouseIds.map((warehouseId) => {
      const state = stateByWarehouse.get(warehouseId);
      const inventory = inventoryByWarehouse.get(warehouseId);
      const layer = layerByWarehouse.get(warehouseId);
      const stateQuantity = state?._sum.quantity ?? 0;
      const stateValue = state?._sum.value ?? new Prisma.Decimal(0);
      const inventoryQuantity = inventory?._sum.quantity ?? 0;
      const layerRemainingQuantity = layer?._sum.remainingQty ?? 0;
      const layerRemainingValue = layer?._sum.remainingValue ?? new Prisma.Decimal(0);
      const layerApplicable = Boolean(layer);
      const quantityDifference = stateQuantity - inventoryQuantity;
      const valueDifference = layerApplicable ? stateValue.minus(layerRemainingValue) : null;
      const warehouse = warehouseById.get(warehouseId);
      totals.stateQuantity += stateQuantity;
      totals.inventoryQuantity += inventoryQuantity;
      totals.quantityDifference += quantityDifference;
      totals.stateValue = totals.stateValue.add(stateValue);
      totals.layerRemainingValue = totals.layerRemainingValue.add(layerRemainingValue);
      totals.layerApplicable ||= layerApplicable;
      return {
        warehouseId,
        code: warehouse?.code ?? null,
        name: warehouse?.name ?? null,
        stateQuantity,
        stateValue: stateValue.toFixed(2),
        inventoryQuantity,
        quantityDifference,
        layerRemainingQuantity,
        layerRemainingValue: layerRemainingValue.toFixed(2),
        layerApplicable,
        valueDifference: valueDifference?.toFixed(2) ?? null,
        matched: quantityDifference === 0 && (!layerApplicable || valueDifference?.isZero() === true),
      };
    });
    const filtered = onlyDifferences ? rows.filter((row) => !row.matched) : rows;
    const glComparable = !query.productId && !query.warehouseId;
    const valueDifferenceVsGl = glComparable ? totals.stateValue.minus(glBalance) : null;
    return {
      asOf: new Date().toISOString(),
      method,
      scope: { warehouseId: query.warehouseId ?? null, productId: query.productId ?? null },
      totals: {
        stateQuantity: totals.stateQuantity,
        inventoryQuantity: totals.inventoryQuantity,
        quantityDifference: totals.quantityDifference,
        stateValue: totals.stateValue.toFixed(2),
        layerRemainingValue: totals.layerRemainingValue.toFixed(2),
        layerApplicable: totals.layerApplicable,
        matched: totals.quantityDifference === 0 && (!totals.layerApplicable || totals.stateValue.equals(totals.layerRemainingValue)),
      },
      gl: {
        accountCode: '1301',
        accountId: inventoryAccount?.id ?? null,
        accountName: inventoryAccount?.name ?? null,
        scope: 'BRANCH',
        debit: glDebit.toFixed(2),
        credit: glCredit.toFixed(2),
        balance: glBalance.toFixed(2),
        comparable: glComparable,
        matched: glComparable ? totals.stateValue.equals(glBalance) : null,
        reason: glComparable ? null : (query.productId ? 'PRODUCT_FILTER' : 'WAREHOUSE_FILTER'),
      },
      valueDifferenceVsGl: valueDifferenceVsGl?.toFixed(2) ?? null,
      byWarehouse: filtered.slice(0, take),
      truncated: filtered.length > take,
    };

  }

  async valuationByLayer(user: AuthUser, query: { warehouseId?: string; productId?: string }) {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, query.warehouseId);
    await this.assertProduct(scope, query.productId);
    const method = await this.activeMethod(scope);
    const rows = await this.prisma.inventoryCostLayer.groupBy({
      by: ['warehouseId', 'productId'],
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        method,
        status: 'OPEN',
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
      },
      _sum: { remainingQty: true, remainingValue: true },
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
    });
    const warehouses = await this.prisma.warehouse.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.warehouseId))] } }, select: { id: true, code: true, name: true } });
    const products = await this.prisma.product.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.productId))] } }, select: { id: true, sku: true, name: true } });
    const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));
    let quantity = 0;
    let value = new Prisma.Decimal(0);
    const items = rows.map((row) => {
      const rowQuantity = row._sum.remainingQty ?? 0;
      const rowValue = row._sum.remainingValue ?? new Prisma.Decimal(0);
      quantity += rowQuantity;
      value = value.add(rowValue);
      const warehouse = warehouseById.get(row.warehouseId);
      const product = productById.get(row.productId);
      return {
        warehouseId: row.warehouseId,
        warehouseCode: warehouse?.code ?? null,
        warehouseName: warehouse?.name ?? null,
        productId: row.productId,
        productSku: product?.sku ?? null,
        productName: product?.name ?? null,
        quantity: rowQuantity,
        value: rowValue.toFixed(2),
      };
    });
    return { asOf: new Date().toISOString(), method, totals: { quantity, value: value.toFixed(2) }, items };
  }

  async parallelRun(user: AuthUser, query: { from?: string; to?: string; warehouseId?: string }) {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, query.warehouseId);
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86_400_000);
    const to = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException({ code: 'COSTING_PARALLEL_RANGE_INVALID', message: 'Rentang tanggal parallel run tidak valid.' });
    }
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: scope.branchId,
        branch: { companyId: scope.companyId },
        createdAt: { gte: from, lte: to },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      include: { items: { include: { product: { select: { id: true, costPrice: true } } } } },
    });
    let legacyCost = new Prisma.Decimal(0);
    for (const sale of sales) {
      for (const item of sale.items) {
        legacyCost = legacyCost.add(new Prisma.Decimal(item.product.costPrice).mul(item.quantity));
      }
    }
    const costingEvents = await this.prisma.inventoryCostEvent.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        sourceType: 'Sale',
        occurredAt: { gte: from, lte: to },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      select: { valueDelta: true },
    });
    let costingCost = new Prisma.Decimal(0);
    for (const event of costingEvents) costingCost = costingCost.add(event.valueDelta.abs());
    return {
      asOf: new Date().toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      sales: sales.length,
      legacyCost: legacyCost.toFixed(2),
      costingCost: costingCost.toFixed(2),
      difference: legacyCost.minus(costingCost).toFixed(2),
      matched: legacyCost.equals(costingCost),
    };
  }
}
