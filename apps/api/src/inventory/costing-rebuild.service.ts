import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { CostingRebuildRun, CostingRebuildStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { costingPayloadHash } from './costing.service';
import { CreateCostingRebuildDto } from './dto/costing.dto';

type TenantScope = { companyId: string; branchId: string };
type RebuildQuery = { status?: string; limit?: string; cursor?: string };

const STATUSES: CostingRebuildStatus[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
const MAX_INVENTORY_ROWS = 5000;
const CHUNK_SIZE = 100;

@Injectable()
export class InventoryCostingRebuildService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async resolveMethod(scope: TenantScope, at: Date): Promise<'MOVING_AVERAGE' | 'FIFO' | 'LIFO'> {
    const branchPolicy = await this.prisma.costingPolicy.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, status: 'ACTIVE', effectiveFrom: { lte: at } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true },
    });
    const policy = branchPolicy ?? await this.prisma.costingPolicy.findFirst({
      where: { companyId: scope.companyId, branchId: null, status: 'ACTIVE', effectiveFrom: { lte: at } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true },
    });
    return policy?.method ?? 'MOVING_AVERAGE';
  }

  private async assertWarehouse(scope: TenantScope, warehouseId?: string): Promise<void> {
    if (!warehouseId) return;
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'Gudang tidak ditemukan pada tenant pengguna.' });
  }

  private async assertRebuildable(scope: TenantScope, warehouseId?: string): Promise<void> {
    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        key: 'inventory.costing',
        enabled: true,
        OR: [
          { companyId: scope.companyId, branchId: scope.branchId },
          { companyId: scope.companyId, branchId: null },
          { companyId: null, branchId: null },
        ],
      },
      select: { id: true },
    });
    if (flag) {
      throw new ConflictException({ code: 'COSTING_REBUILD_FLAG_ENABLED', message: 'Matikan feature flag inventory.costing sebelum backfill snapshot.' });
    }
    const scopeWhere = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      ...(warehouseId ? { warehouseId } : {}),
    };
    const [events, states] = await Promise.all([
      this.prisma.inventoryCostEvent.count({ where: scopeWhere }),
      this.prisma.inventoryCostState.count({ where: scopeWhere }),
    ]);
    if (events > 0) {
      throw new ConflictException({ code: 'COSTING_REBUILD_EVENTS_EXIST', message: 'Backfill snapshot hanya boleh dijalankan sebelum ada cost event pada scope ini.' });
    }
    if (states > 0) {
      throw new ConflictException({ code: 'COSTING_REBUILD_STATE_EXISTS', message: 'Cost state sudah ada pada scope ini; gunakan rebuild dari event, bukan backfill snapshot.' });
    }
  }

  private async audit(companyId: string, userId: string, action: string, run: Pick<CostingRebuildRun, 'id' | 'branchId' | 'warehouseId'>, payload: Record<string, unknown>): Promise<void> {
    await this.prisma.auditLog.create({ data: {
      companyId, userId, action, entityType: 'CostingRebuildRun', entityId: run.id,
      payload: { branchId: run.branchId, warehouseId: run.warehouseId, ...payload },
    } });
  }

  async request(user: AuthUser, dto: CreateCostingRebuildDto): Promise<CostingRebuildRun> {
    const scope = this.requireTenantScope(user);
    await this.assertWarehouse(scope, dto.warehouseId);
    const cutoverAt = new Date(dto.cutoverAt);
    if (Number.isNaN(cutoverAt.getTime())) {
      throw new BadRequestException({ code: 'COSTING_REBUILD_DATE_INVALID', message: 'cutoverAt bukan tanggal yang valid.' });
    }
    const operationKey = dto.operationKey.trim();
    if (operationKey.length < 8) {
      throw new BadRequestException({ code: 'COSTING_REBUILD_OPERATION_KEY_INVALID', message: 'operationKey minimal 8 karakter.' });
    }
    const existing = await this.prisma.costingRebuildRun.findUnique({
      where: { companyId_operationKey: { companyId: scope.companyId, operationKey } },
    });
    if (existing) {
      if (existing.branchId !== scope.branchId || existing.warehouseId !== (dto.warehouseId ?? null) || existing.fromDate.getTime() !== cutoverAt.getTime()) {
        throw new ConflictException({ code: 'COSTING_REBUILD_OPERATION_CONFLICT', message: 'operationKey sudah dipakai untuk scope atau tanggal lain.' });
      }
      return existing;
    }
    await this.assertRebuildable(scope, dto.warehouseId);
    const method = await this.resolveMethod(scope, cutoverAt);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await tx.costingRebuildRun.create({ data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          warehouseId: dto.warehouseId ?? null,
          method,
          mode: 'SHADOW',
          fromDate: cutoverAt,
          toDate: cutoverAt,
          status: 'PENDING',
          operationKey,
          statistics: { requestedBy: user.sub },
        } });
        await tx.auditLog.create({ data: {
          companyId: scope.companyId, userId: user.sub, action: 'COSTING_REBUILD_REQUESTED', entityType: 'CostingRebuildRun', entityId: run.id,
          payload: { branchId: run.branchId, warehouseId: run.warehouseId, cutoverAt: cutoverAt.toISOString(), operationKey },
        } });
        return run;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.costingRebuildRun.findUnique({
          where: { companyId_operationKey: { companyId: scope.companyId, operationKey } },
        });
        if (raced && raced.branchId === scope.branchId && raced.warehouseId === (dto.warehouseId ?? null) && raced.fromDate.getTime() === cutoverAt.getTime()) {
          return raced;
        }
      }
      throw error;
    }
  }

  async list(user: AuthUser, query: RebuildQuery) {
    const scope = this.requireTenantScope(user);
    if (query.status && !STATUSES.includes(query.status as CostingRebuildStatus)) {
      throw new BadRequestException({ code: 'COSTING_REBUILD_STATUS_INVALID', message: 'Status rebuild tidak valid.' });
    }
    const take = this.limit(query.limit);
    const rows = await this.prisma.costingRebuildRun.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        ...(query.status ? { status: query.status as CostingRebuildStatus } : {}),
      },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: rows.slice(0, take), nextCursor: rows.length > take ? rows[take].id : null };
  }

  async get(user: AuthUser, id: string): Promise<CostingRebuildRun> {
    const scope = this.requireTenantScope(user);
    const run = await this.prisma.costingRebuildRun.findFirst({ where: { id, companyId: scope.companyId, branchId: scope.branchId } });
    if (!run) throw new NotFoundException({ code: 'COSTING_REBUILD_NOT_FOUND', message: 'Rebuild run tidak ditemukan pada tenant pengguna.' });
    return run;
  }

  async approve(user: AuthUser, id: string): Promise<CostingRebuildRun> {
    const scope = this.requireTenantScope(user);
    const run = await this.get(user, id);
    if (run.status !== 'PENDING') {
      throw new ConflictException({ code: 'COSTING_REBUILD_NOT_PENDING', message: 'Hanya rebuild PENDING yang dapat disetujui.' });
    }
    const creator = await this.prisma.auditLog.findFirst({
      where: { companyId: scope.companyId, action: 'COSTING_REBUILD_REQUESTED', entityType: 'CostingRebuildRun', entityId: run.id },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!creator?.userId) {
      throw new ConflictException({ code: 'COSTING_REBUILD_MAKER_MISSING', message: 'Jejak pembuat rebuild tidak ditemukan.' });
    }
    if (creator.userId === user.sub) {
      throw new ForbiddenException({ code: 'COSTING_REBUILD_MAKER_CHECKER', message: 'Approval rebuild membutuhkan approver yang berbeda dari pembuat.' });
    }
    const claimed = await this.prisma.costingRebuildRun.updateMany({
      where: { id: run.id, status: 'PENDING' },
      data: { status: 'RUNNING', approvedBy: user.sub, startedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new ConflictException({ code: 'COSTING_REBUILD_NOT_PENDING', message: 'Rebuild sudah diproses oleh operator lain.' });
    }
    const claimedRun = await this.prisma.costingRebuildRun.findUnique({ where: { id: run.id } });
    if (!claimedRun) throw new NotFoundException({ code: 'COSTING_REBUILD_NOT_FOUND', message: 'Rebuild run tidak ditemukan pada tenant pengguna.' });
    try {
      await this.assertRebuildable(scope, run.warehouseId ?? undefined);
      const statistics = await this.execute(claimedRun);
      const updated = await this.prisma.costingRebuildRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), statistics },
      });
      await this.audit(scope.companyId, user.sub, 'COSTING_REBUILD_COMPLETED', run, { ...statistics });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rebuild gagal.';
      await this.prisma.costingRebuildRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), statistics: { error: message } },
      });
      await this.audit(scope.companyId, user.sub, 'COSTING_REBUILD_FAILED', run, { error: message }).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({ code: 'COSTING_REBUILD_FAILED', message });
    }
  }

  async resume(user: AuthUser, id: string): Promise<CostingRebuildRun> {
    const scope = this.requireTenantScope(user);
    const run = await this.get(user, id);
    if (run.status === 'COMPLETED') {
      return run;
    }
    if (run.status === 'CANCELLED') {
      throw new ConflictException({ code: 'COSTING_REBUILD_CANCELLED', message: 'Rebuild yang dibatalkan tidak dapat dilanjutkan.' });
    }
    if (run.status === 'FAILED') {
      await this.prisma.costingRebuildRun.updateMany({
        where: { id: run.id, status: 'FAILED' },
        data: { status: 'RUNNING', finishedAt: null, startedAt: run.startedAt ?? new Date(), approvedBy: run.approvedBy ?? user.sub },
      });
    } else if (run.status === 'PENDING') {
      await this.prisma.costingRebuildRun.updateMany({
        where: { id: run.id, status: 'PENDING' },
        data: { status: 'RUNNING', approvedBy: run.approvedBy ?? user.sub, startedAt: run.startedAt ?? new Date() },
      });
    }
    const current = await this.prisma.costingRebuildRun.findFirst({ where: { id: run.id, companyId: scope.companyId, branchId: scope.branchId } });
    if (!current) throw new NotFoundException({ code: 'COSTING_REBUILD_NOT_FOUND', message: 'Rebuild run tidak ditemukan pada tenant pengguna.' });
    if (current.status !== 'RUNNING') {
      throw new ConflictException({ code: 'COSTING_REBUILD_NOT_RUNNING', message: 'Hanya rebuild RUNNING/FAILED/PENDING yang dapat dilanjutkan.' });
    }
    if (!current.approvedBy) {
      await this.prisma.costingRebuildRun.update({ where: { id: current.id }, data: { approvedBy: user.sub, startedAt: current.startedAt ?? new Date() } });
    }
    const fresh = await this.prisma.costingRebuildRun.findUnique({ where: { id: current.id } });
    if (!fresh) throw new NotFoundException({ code: 'COSTING_REBUILD_NOT_FOUND', message: 'Rebuild run tidak ditemukan pada tenant pengguna.' });
    try {
      const statistics = await this.execute(fresh);
      const updated = await this.prisma.costingRebuildRun.update({
        where: { id: fresh.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), statistics },
      });
      await this.audit(scope.companyId, user.sub, 'COSTING_REBUILD_COMPLETED', fresh, { ...statistics, resumed: true });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rebuild gagal.';
      await this.prisma.costingRebuildRun.update({
        where: { id: fresh.id },
        data: { status: 'FAILED', finishedAt: new Date(), statistics: { error: message } },
      });
      await this.audit(scope.companyId, user.sub, 'COSTING_REBUILD_FAILED', fresh, { error: message }).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({ code: 'COSTING_REBUILD_FAILED', message });
    }
  }

  private async execute(run: CostingRebuildRun): Promise<any> {
    const scopeWhere = {
      warehouse: { branchId: run.branchId, branch: { companyId: run.companyId } },
      ...(run.warehouseId ? { warehouseId: run.warehouseId } : {}),
    };
    const total = await this.prisma.inventory.count({ where: scopeWhere });
    if (total > MAX_INVENTORY_ROWS) {
      throw new BadRequestException({ code: 'COSTING_REBUILD_TOO_LARGE', message: `Backfill dibatasi ${MAX_INVENTORY_ROWS} baris inventory per run.` });
    }

    const statistics: any = {
      cutoverAt: run.toDate.toISOString(),
      snapshotAt: new Date().toISOString(),
      inventoryRows: 0,
      statesCreated: 0,
      layersCreated: 0,
      batchStates: 0,
      totalQuantity: 0,
      totalValue: new Prisma.Decimal(0),
      method: run.method,
      mode: 'SHADOW',
    };

    let checkpoint: string | null = run.checkpoint ?? null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const chunk = await this.prisma.inventory.findMany({
        where: {
          warehouse: { branchId: run.branchId, branch: { companyId: run.companyId } },
          ...(run.warehouseId ? { warehouseId: run.warehouseId } : {}),
          ...(checkpoint ? { id: { gt: checkpoint } } : {}),
        },
        orderBy: { id: 'asc' },
        take: CHUNK_SIZE,
        include: { product: { select: { id: true, companyId: true, costPrice: true, trackBatch: true } } },
      });
      if (chunk.length === 0) break;

      await this.prisma.$transaction(async (tx) => {
        const warehouseIds = [...new Set(chunk.map((row) => row.warehouseId))];
        const batchProductIds = [...new Set(chunk.filter((row) => row.product.trackBatch).map((row) => row.productId))];
        const batches = warehouseIds.length && batchProductIds.length
          ? await tx.inventoryBatch.findMany({
              where: { warehouseId: { in: warehouseIds }, productId: { in: batchProductIds } },
              select: { warehouseId: true, productId: true, batchNumber: true, quantity: true },
            })
          : [];
        const batchesByProduct = new Map<string, { batchNumber: string; quantity: number }[]>();
        for (const batch of batches) {
          const key = `${batch.warehouseId}:${batch.productId}`;
          const rows = batchesByProduct.get(key) ?? [];
          rows.push({ batchNumber: batch.batchNumber, quantity: batch.quantity });
          batchesByProduct.set(key, rows);
        }

        const states: Prisma.InventoryCostStateCreateManyInput[] = [];
        const openingLayers: { warehouseId: string; productId: string; batchKey: string; quantity: number; value: Prisma.Decimal }[] = [];
        let batchStates = 0;
        let totalQuantity = 0;
        let totalValue = new Prisma.Decimal(0);

        for (const row of chunk) {
          if (row.product.companyId && row.product.companyId !== run.companyId) {
            throw new BadRequestException({ code: 'COSTING_REBUILD_PRODUCT_TENANT_MISMATCH', message: `Produk ${row.productId} bukan milik company ini.` });
          }
          if (row.product.trackBatch) {
            const productBatches = batchesByProduct.get(`${row.warehouseId}:${row.productId}`) ?? [];
            const batchQuantity = productBatches.reduce((sum, batch) => sum + batch.quantity, 0);
            if (batchQuantity !== row.quantity) {
              throw new BadRequestException({
                code: 'COSTING_REBUILD_BATCH_MISMATCH',
                message: `Jumlah batch ${row.productId} di ${row.warehouseId} (${batchQuantity}) tidak sama dengan inventory (${row.quantity}).`,
              });
            }
            if (row.quantity === 0) continue;
            for (const batch of productBatches) {
              if (batch.quantity === 0) continue;
              const value = row.product.costPrice.mul(batch.quantity);
              states.push({
                companyId: run.companyId, branchId: run.branchId, warehouseId: row.warehouseId, productId: row.productId,
                batchKey: batch.batchNumber, method: run.method, quantity: batch.quantity, value,
                averageCost: row.product.costPrice,
              });
              openingLayers.push({ warehouseId: row.warehouseId, productId: row.productId, batchKey: batch.batchNumber, quantity: batch.quantity, value });
              batchStates += 1;
              totalQuantity += batch.quantity;
              totalValue = totalValue.add(value);
            }
          } else {
            if (row.quantity === 0) continue;
            const value = row.product.costPrice.mul(row.quantity);
            states.push({
              companyId: run.companyId, branchId: run.branchId, warehouseId: row.warehouseId, productId: row.productId,
              batchKey: '', method: run.method, quantity: row.quantity, value,
              averageCost: row.product.costPrice,
            });
            openingLayers.push({ warehouseId: row.warehouseId, productId: row.productId, batchKey: '', quantity: row.quantity, value });
            totalQuantity += row.quantity;
            totalValue = totalValue.add(value);
          }
        }

        const newStates: Prisma.InventoryCostStateCreateManyInput[] = [];
        for (const st of states) {
          const existing = await tx.inventoryCostState.findUnique({
            where: { companyId_branchId_warehouseId_productId_batchKey_method: {
              companyId: st.companyId as string, branchId: st.branchId as string, warehouseId: st.warehouseId as string,
              productId: st.productId as string, batchKey: st.batchKey as string, method: st.method as any,
            } },
            select: { id: true },
          });
          if (!existing) newStates.push(st);
        }
        if (newStates.length) await tx.inventoryCostState.createMany({ data: newStates });

        if (run.method !== 'MOVING_AVERAGE') {
          for (const layer of openingLayers) {
            const sourceLineKey = `${layer.warehouseId}:${layer.productId}:${layer.batchKey}`;
            const existingEvent = await tx.inventoryCostEvent.findUnique({
              where: { companyId_sourceType_sourceId_sourceLineKey_eventType: {
                companyId: run.companyId, sourceType: 'COSTING_BACKFILL', sourceId: run.id, sourceLineKey, eventType: 'OPENING',
              } },
              select: { id: true },
            });
            if (existingEvent) continue;
            const event = await tx.inventoryCostEvent.create({
              data: {
                companyId: run.companyId,
                branchId: run.branchId,
                warehouseId: layer.warehouseId,
                productId: layer.productId,
                batchKey: layer.batchKey,
                eventType: 'OPENING',
                method: run.method,
                quantityDelta: layer.quantity,
                uncostedQuantity: 0,
                valueDelta: layer.value,
                unitCost: layer.value.div(layer.quantity).toDecimalPlaces(6),
                balanceQuantity: layer.quantity,
                balanceValue: layer.value,
                occurredAt: run.toDate,
                sourceType: 'COSTING_BACKFILL',
                sourceId: run.id,
                sourceLineKey,
                operationKey: `rebuild:${run.id}:${sourceLineKey}`,
                payloadHash: costingPayloadHash({ runId: run.id, sourceLineKey, ...layer, value: layer.value.toFixed(6) }),
                createdById: run.approvedBy ?? undefined,
              },
              select: { id: true },
            });
            await tx.inventoryCostLayer.create({
              data: {
                companyId: run.companyId,
                branchId: run.branchId,
                warehouseId: layer.warehouseId,
                productId: layer.productId,
                batchKey: layer.batchKey,
                method: run.method,
                sourceEventId: event.id,
                receivedAt: run.toDate,
                originalQty: layer.quantity,
                remainingQty: layer.quantity,
                unitCost: layer.value.div(layer.quantity).toDecimalPlaces(6),
                originalValue: layer.value,
                remainingValue: layer.value,
                status: 'OPEN',
              },
            });
          }
        }

        statistics.inventoryRows += chunk.length;
        statistics.statesCreated += states.length;
        statistics.layersCreated += run.method !== 'MOVING_AVERAGE' ? openingLayers.length : 0;
        statistics.batchStates += batchStates;
        statistics.totalQuantity += totalQuantity;
        statistics.totalValue = statistics.totalValue.add(totalValue);

        const lastId = chunk[chunk.length - 1].id;
        await tx.costingRebuildRun.update({
          where: { id: run.id },
          data: { checkpoint: lastId, status: 'RUNNING' },
        });
      }, { timeout: 120_000 });

      checkpoint = chunk[chunk.length - 1].id;
    }

    // recompute statesCreated/layersCreated? We accumulated states.length/batch count in loop but variables scoped.
    // The above accumulation referenced states/openingLayers which are out of scope; fix below.
    statistics.totalValue = statistics.totalValue.toFixed(6);
    return statistics;
  }
}
