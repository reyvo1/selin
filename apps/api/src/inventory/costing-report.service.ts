import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryCostLayerStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type TenantScope = { companyId: string; branchId: string };
type LayerQuery = { warehouseId?: string; productId?: string; batchKey?: string; status?: string; limit?: string; cursor?: string };
type ReconciliationQuery = { warehouseId?: string; productId?: string; limit?: string; onlyDifferences?: string };

const LAYER_STATUSES: InventoryCostLayerStatus[] = ['OPEN', 'CONSUMED', 'REVERSED'];
const METHOD = 'MOVING_AVERAGE' as const;

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
    const status = query.status ?? 'OPEN';
    if (!LAYER_STATUSES.includes(status as InventoryCostLayerStatus)) {
      throw new BadRequestException({ code: 'COSTING_LAYER_STATUS_INVALID', message: 'Status layer costing tidak valid.' });
    }
    const take = this.limit(query.limit, 50, 200);
    const rows = await this.prisma.inventoryCostLayer.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        method: METHOD,
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
    return { items, nextCursor: rows.length > take ? rows[take].id : null };
  }

  async reconciliation(user: AuthUser, query: ReconciliationQuery) {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, query.warehouseId);
    await this.assertProduct(scope, query.productId);
    const take = this.limit(query.limit, 100, 200);
    const onlyDifferences = query.onlyDifferences === 'true';
    const stateWhere: Prisma.InventoryCostStateWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      method: METHOD,
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
      method: METHOD,
      status: 'OPEN',
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [stateGroups, inventoryGroups, layerGroups] = await Promise.all([
      this.prisma.inventoryCostState.groupBy({ by: ['warehouseId'], where: stateWhere, _sum: { quantity: true, value: true } }),
      this.prisma.inventory.groupBy({ by: ['warehouseId'], where: inventoryWhere, _sum: { quantity: true } }),
      this.prisma.inventoryCostLayer.groupBy({ by: ['warehouseId'], where: layerWhere, _sum: { remainingQty: true, remainingValue: true } }),
    ]);
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
    return {
      asOf: new Date().toISOString(),
      method: METHOD,
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
      byWarehouse: filtered.slice(0, take),
      truncated: filtered.length > take,
    };
  }
}
