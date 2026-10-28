import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

export type CostingScope = {
  companyId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  batchKey?: string;
};

export type CostingSource = {
  sourceType: string;
  sourceId: string;
  sourceLineKey: string;
  operationKey: string;
  payloadHash: string;
  movementId?: string;
  createdById?: string;
  occurredAt: Date;
};

export type ReceiptCostInput = CostingScope &
  CostingSource & {
    quantity: number;
    totalValue: Prisma.Decimal | string | number;
  };

export type IssueCostInput = CostingScope &
  CostingSource & {
    quantity: number;
    preferredLayerSourceEventId?: string;
  };

export type ReversalCostInput = CostingScope &
  CostingSource & {
    reversesEventId: string;
  };

export type CostingResult = {
  event: {
    id: string;
    quantityDelta: number;
    valueDelta: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    balanceQuantity: number;
    balanceValue: Prisma.Decimal;
    uncostedQuantity: number;
  };
  cost: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  uncostedQuantity: number;
};

type CostingPolicyRecord = {
  method: 'MOVING_AVERAGE' | 'FIFO' | 'LIFO';
  mode: 'SHADOW' | 'ACTIVE';
};

type StateRecord = {
  id: string;
  version: number;
  quantity: number;
  value: Prisma.Decimal;
  averageCost: Prisma.Decimal;
};

type LayerConsumption = {
  layerId: string;
  quantity: number;
  amount: Prisma.Decimal;
  remainingQty: number;
  remainingValue: Prisma.Decimal;
};

type ComputedCost = {
  quantityDelta: number;
  uncostedQuantity: number;
  valueDelta: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  quantity: number;
  value: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  newLayer?: boolean;
  consumptions?: LayerConsumption[];
};

const MONEY_PLACES = 6;

export function costingPayloadHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class InventoryCostingService {
  async isEnabled(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
  ): Promise<boolean> {
    const flag = await tx.featureFlag.findFirst({
      where: {
        key: 'inventory.costing',
        enabled: true,
        OR: [
          { companyId, branchId },
          { companyId, branchId: null },
          { companyId: null, branchId: null },
        ],
      },
      select: { id: true },
    });
    return Boolean(flag);
  }

  async resolveMode(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
    occurredAt: Date,
  ): Promise<CostingPolicyRecord['mode'] | null> {
    if (!(await this.isEnabled(tx, companyId, branchId))) return null;
    const policy = await this.resolvePolicy(tx, { companyId, branchId }, occurredAt);
    return policy.mode;
  }

  private async resolvePolicy(
    tx: Prisma.TransactionClient,
    scope: Pick<CostingScope, 'companyId' | 'branchId'>,
    occurredAt: Date,
  ): Promise<CostingPolicyRecord> {
    const branchPolicy = await tx.costingPolicy.findFirst({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        status: 'ACTIVE',
        effectiveFrom: { lte: occurredAt },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true, mode: true },
    });
    const policy = branchPolicy ?? (await tx.costingPolicy.findFirst({
      where: {
        companyId: scope.companyId,
        branchId: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: occurredAt },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { method: true, mode: true },
    }));
    if (!policy) {
      throw new BadRequestException('Costing policy aktif belum tersedia untuk company/branch ini.');
    }
    return policy;
  }

  private async assertPeriodOpen(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
    occurredAt: Date,
  ): Promise<void> {
    const closed = await tx.fiscalPeriod.findFirst({
      where: {
        companyId,
        OR: [{ branchId }, { branchId: null }],
        startDate: { lte: occurredAt },
        endDate: { gte: occurredAt },
        status: 'CLOSED',
      },
      select: { id: true },
    });
    if (closed) {
      throw new ConflictException({ code: 'FISCAL_PERIOD_CLOSED', message: 'Periode fiskal berstatus CLOSED; posting costing tidak diizinkan.' });
    }
  }

  private async assertNotBackdated(
    tx: Prisma.TransactionClient,
    input: CostingScope & CostingSource,
    method: CostingPolicyRecord['method'],
  ): Promise<void> {
    const batchKey = input.batchKey ?? '';
    const later = await tx.inventoryCostEvent.findFirst({
      where: {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchKey,
        method,
        status: 'POSTED',
        occurredAt: { gt: input.occurredAt },
      },
      select: { id: true, occurredAt: true },
    });
    if (later) {
      throw new ConflictException(
        `Backdated costing ditolak: sudah ada event ${later.id} pada ${later.occurredAt.toISOString()}. Lakukan rebuild/cutover dengan approval, bukan koreksi diam-diam.`,
      );
    }
  }

  private async existingEvent(
    tx: Prisma.TransactionClient,
    input: CostingScope & CostingSource,
  ) {
    const replay = await tx.inventoryCostEvent.findUnique({
      where: { companyId_operationKey: { companyId: input.companyId, operationKey: input.operationKey } },
      select: {
        id: true,
        quantityDelta: true,
        valueDelta: true,
        unitCost: true,
        balanceQuantity: true,
        balanceValue: true,
        uncostedQuantity: true,
        payloadHash: true,
        sourceType: true,
        sourceId: true,
        sourceLineKey: true,
      },
    });
    if (replay) {
      if (replay.payloadHash !== input.payloadHash) {
        throw new ConflictException('Operation key costing sudah dipakai dengan payload yang berbeda.');
      }
      return replay;
    }

    const source = await tx.inventoryCostEvent.findFirst({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceLineKey: input.sourceLineKey,
        eventType: { in: ['RECEIPT', 'ISSUE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE'] },
      },
      select: {
        id: true,
        quantityDelta: true,
        valueDelta: true,
        unitCost: true,
        balanceQuantity: true,
        balanceValue: true,
        uncostedQuantity: true,
        payloadHash: true,
        sourceType: true,
        sourceId: true,
        sourceLineKey: true,
      },
    });
    if (!source) return null;
    if (source.payloadHash !== input.payloadHash) {
      throw new ConflictException('Source costing sudah diposting dengan payload yang berbeda.');
    }
    return source;
  }

  private resultFromEvent(event: {
    id: string;
    quantityDelta: number;
    valueDelta: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    balanceQuantity: number;
    balanceValue: Prisma.Decimal;
    uncostedQuantity: number;
  }): CostingResult {
    const value = new Prisma.Decimal(event.valueDelta);
    return {
      event: {
        id: event.id,
        quantityDelta: event.quantityDelta,
        valueDelta: value,
        unitCost: new Prisma.Decimal(event.unitCost),
        balanceQuantity: event.balanceQuantity,
        balanceValue: new Prisma.Decimal(event.balanceValue),
        uncostedQuantity: event.uncostedQuantity,
      },
      cost: value.abs(),
      unitCost: new Prisma.Decimal(event.unitCost),
      uncostedQuantity: event.uncostedQuantity,
    };
  }

  private async readState(
    tx: Prisma.TransactionClient,
    scope: CostingScope,
    method: CostingPolicyRecord['method'],
  ): Promise<StateRecord | null> {
    return tx.inventoryCostState.findUnique({
      where: {
        companyId_branchId_warehouseId_productId_batchKey_method: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          warehouseId: scope.warehouseId,
          productId: scope.productId,
          batchKey: scope.batchKey ?? '',
          method,
        },
      },
      select: { id: true, version: true, quantity: true, value: true, averageCost: true },
    });
  }

  private layerOrder(method: CostingPolicyRecord['method']): Prisma.InventoryCostLayerOrderByWithRelationInput[] {
    return method === 'LIFO'
      ? [{ receivedAt: 'desc' }, { id: 'desc' }]
      : [{ receivedAt: 'asc' }, { id: 'asc' }];
  }

  private async planConsumption(
    tx: Prisma.TransactionClient,
    scope: CostingScope,
    method: CostingPolicyRecord['method'],
    quantity: number,
    preferredLayerSourceEventId?: string,
  ): Promise<{ cost: Prisma.Decimal; unitCost: Prisma.Decimal; uncostedQuantity: number; consumptions: LayerConsumption[] }> {
    const candidates = await tx.inventoryCostLayer.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        warehouseId: scope.warehouseId,
        productId: scope.productId,
        batchKey: scope.batchKey ?? '',
        method,
        status: 'OPEN',
        remainingQty: { gt: 0 },
      },
      orderBy: this.layerOrder(method),
      select: { id: true, sourceEventId: true, remainingQty: true, remainingValue: true },
    });
    const preferredIndex = preferredLayerSourceEventId
      ? candidates.findIndex((layer) => layer.sourceEventId === preferredLayerSourceEventId)
      : -1;
    const layers = preferredIndex > 0
      ? [candidates[preferredIndex], ...candidates.slice(0, preferredIndex), ...candidates.slice(preferredIndex + 1)]
      : candidates;
    let remaining = quantity;
    let cost = new Prisma.Decimal(0);
    const consumptions: LayerConsumption[] = [];
    for (const layer of layers) {
      if (remaining <= 0) break;
      if (layer.remainingValue.lessThan(0)) {
        throw new ConflictException(`Layer costing ${layer.id} memiliki nilai negatif.`);
      }
      const take = Math.min(remaining, layer.remainingQty);
      const amount = take === layer.remainingQty
        ? layer.remainingValue
        : layer.remainingValue.mul(take).div(layer.remainingQty).toDecimalPlaces(MONEY_PLACES);
      const remainingValue = layer.remainingValue.sub(amount);
      if (remainingValue.lessThan(0)) {
        throw new ConflictException(`Layer costing ${layer.id} tidak konsisten: nilai sisa negatif.`);
      }
      consumptions.push({
        layerId: layer.id,
        quantity: take,
        amount,
        remainingQty: layer.remainingQty - take,
        remainingValue,
      });
      cost = cost.add(amount);
      remaining -= take;
    }
    return {
      cost,
      unitCost: quantity > 0 ? cost.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
      uncostedQuantity: remaining,
      consumptions,
    };
  }

  private async previewConsumption(
    tx: Prisma.TransactionClient,
    scope: CostingScope,
    method: CostingPolicyRecord['method'],
    quantity: number,
  ) {
    return this.planConsumption(tx, scope, method, quantity);
  }

  private async applyLayerChanges(
    tx: Prisma.TransactionClient,
    input: CostingScope & CostingSource,
    method: CostingPolicyRecord['method'],
    eventId: string,
    computed: ComputedCost,
  ): Promise<void> {
    if (method === 'MOVING_AVERAGE') return;
    if (computed.newLayer) {
      const receipt = input as Partial<ReceiptCostInput>;
      if (typeof receipt.quantity !== 'number' || receipt.totalValue === undefined) {
        throw new ConflictException('Layer costing membutuhkan quantity dan totalValue.');
      }
      const quantity = receipt.quantity;
      const totalValue = new Prisma.Decimal(receipt.totalValue);
      await tx.inventoryCostLayer.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          productId: input.productId,
          batchKey: input.batchKey ?? '',
          method,
          sourceEventId: eventId,
          receivedAt: input.occurredAt,
          originalQty: quantity,
          remainingQty: quantity,
          unitCost: totalValue.div(quantity).toDecimalPlaces(MONEY_PLACES),
          originalValue: totalValue,
          remainingValue: totalValue,
          status: 'OPEN',
        },
      });
    }
    for (const consumption of computed.consumptions ?? []) {
      const updated = await tx.inventoryCostLayer.updateMany({
        where: { id: consumption.layerId, status: 'OPEN', remainingQty: consumption.remainingQty + consumption.quantity },
        data: {
          remainingQty: consumption.remainingQty,
          remainingValue: consumption.remainingValue,
          status: consumption.remainingQty === 0 ? 'CONSUMED' : 'OPEN',
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(`Layer costing ${consumption.layerId} berubah bersamaan; ulangi transaksi.`);
      }
      await tx.inventoryCostConsumption.create({
        data: {
          companyId: input.companyId,
          layerId: consumption.layerId,
          eventId,
          quantity: consumption.quantity,
          amount: consumption.amount,
        },
      });
    }
  }

  private async postEvent(
    tx: Prisma.TransactionClient,
    input: CostingScope & CostingSource,
    method: CostingPolicyRecord['method'],
    eventType: 'RECEIPT' | 'ISSUE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE' | 'REVERSAL',
    compute: (state: StateRecord | null) => ComputedCost | Promise<ComputedCost>,
  ): Promise<CostingResult> {
    const batchKey = input.batchKey ?? '';
    const replay = await this.existingEvent(tx, input);
    if (replay) return this.resultFromEvent(replay);

    await this.assertPeriodOpen(tx, input.companyId, input.branchId, input.occurredAt);
    await this.assertNotBackdated(tx, input, method);

    let state = await this.readState(tx, input, method);
    if (!state) {
      state = await tx.inventoryCostState.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          productId: input.productId,
          batchKey,
          method,
          quantity: 0,
          value: new Prisma.Decimal(0),
          averageCost: new Prisma.Decimal(0),
          version: 0,
        },
        select: { id: true, version: true, quantity: true, value: true, averageCost: true },
      });
    }

    const computed = await compute(state);
    if (computed.quantity < 0 && computed.quantityDelta > 0) {
      throw new ConflictException('State costing tidak konsisten: penerimaan menghasilkan quantity negatif.');
    }

    const updated = await tx.inventoryCostState.updateMany({
      where: { id: state.id, version: state.version },
      data: {
        quantity: computed.quantity,
        value: computed.value,
        averageCost: computed.averageCost,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('State costing berubah bersamaan; ulangi transaksi.');
    }

    const event = await tx.inventoryCostEvent.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchKey,
        movementId: input.movementId,
        eventType,
        method,
        quantityDelta: computed.quantityDelta,
        uncostedQuantity: computed.uncostedQuantity,
        valueDelta: computed.valueDelta,
        unitCost: computed.unitCost,
        balanceQuantity: computed.quantity,
        balanceValue: computed.value,
        occurredAt: input.occurredAt,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceLineKey: input.sourceLineKey,
        operationKey: input.operationKey,
        payloadHash: input.payloadHash,
        createdById: input.createdById,
      },
      select: {
        id: true,
        quantityDelta: true,
        valueDelta: true,
        unitCost: true,
        balanceQuantity: true,
        balanceValue: true,
        uncostedQuantity: true,
      },
    });
    await this.applyLayerChanges(tx, input, method, event.id, computed);
    return this.resultFromEvent(event);
  }

  async recordReceipt(tx: Prisma.TransactionClient, input: ReceiptCostInput): Promise<CostingResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Quantity penerimaan costing harus bilangan bulat positif.');
    }
    const totalValue = new Prisma.Decimal(input.totalValue);
    if (totalValue.lessThan(0)) throw new BadRequestException('Nilai penerimaan costing tidak boleh negatif.');
    const policy = await this.resolvePolicy(tx, input, input.occurredAt);
    return this.postEvent(tx, input, policy.method, 'RECEIPT', (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      const quantity = previousQty + input.quantity;
      const value = previousValue.add(totalValue);
      return {
        quantityDelta: input.quantity,
        uncostedQuantity: 0,
        valueDelta: totalValue,
        unitCost: totalValue.div(input.quantity).toDecimalPlaces(MONEY_PLACES),
        quantity,
        value,
        averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
        newLayer: policy.method !== 'MOVING_AVERAGE',
      };
    });
  }

  async recordReceiptReversal(tx: Prisma.TransactionClient, input: CostingScope & CostingSource & { occurredAt: Date }): Promise<CostingResult | null> {
    const original = await tx.inventoryCostEvent.findFirst({
      where: {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchKey: input.batchKey ?? '',
        eventType: 'RECEIPT',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceLineKey: input.sourceLineKey,
      },
    });
    if (!original) return null;

    const layer = await tx.inventoryCostLayer.findUnique({ where: { sourceEventId: original.id } });
    if (layer && layer.remainingQty !== layer.originalQty) {
      throw new ConflictException('Layer costing sudah dikonsumsi; reversal receipt tidak dapat dilakukan.');
    }
    if (layer) {
      await tx.inventoryCostLayer.delete({ where: { id: layer.id } });
    }

    const policy = await this.resolvePolicy(tx, input, input.occurredAt);
    return this.postEvent(tx, input, policy.method, 'REVERSAL', (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      const quantity = Math.max(0, previousQty - original.quantityDelta);
      const value = quantity > 0 ? previousValue.sub(original.valueDelta) : new Prisma.Decimal(0);
      return {
        quantityDelta: -original.quantityDelta,
        uncostedQuantity: 0,
        valueDelta: original.valueDelta.negated(),
        unitCost: original.unitCost,
        quantity,
        value: value.greaterThan(0) ? value : new Prisma.Decimal(0),
        averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
      };
    });
  }

  async recordSaleReturn(tx: Prisma.TransactionClient, input: ReceiptCostInput): Promise<CostingResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Quantity retur costing harus bilangan bulat positif.');
    }
    const totalValue = new Prisma.Decimal(input.totalValue);
    if (totalValue.lessThan(0)) throw new BadRequestException('Nilai retur costing tidak boleh negatif.');
    const policy = await this.resolvePolicy(tx, input, input.occurredAt);
    return this.postEvent(tx, input, policy.method, 'SALE_RETURN', (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      const quantity = previousQty + input.quantity;
      const value = previousValue.add(totalValue);
      return {
        quantityDelta: input.quantity,
        uncostedQuantity: 0,
        valueDelta: totalValue,
        unitCost: totalValue.div(input.quantity).toDecimalPlaces(MONEY_PLACES),
        quantity,
        value,
        averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
        newLayer: policy.method !== 'MOVING_AVERAGE',
      };
    });
  }

  private async recordOutbound(
    tx: Prisma.TransactionClient,
    input: IssueCostInput,
    eventType: 'ISSUE' | 'PURCHASE_RETURN',
    label: string,
  ): Promise<CostingResult> {
    const policy = await this.resolvePolicy(tx, input, input.occurredAt);
    const result = await this.postEvent(tx, input, policy.method, eventType, async (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      if (policy.method !== 'MOVING_AVERAGE') {
        const plan = await this.planConsumption(tx, input, policy.method, input.quantity, input.preferredLayerSourceEventId);
        const quantity = Math.max(0, previousQty - input.quantity);
        const rawValue = previousValue.sub(plan.cost);
        const value = quantity > 0 && rawValue.greaterThan(0) ? rawValue : new Prisma.Decimal(0);
        return {
          quantityDelta: -input.quantity,
          uncostedQuantity: plan.uncostedQuantity,
          valueDelta: plan.cost.negated(),
          unitCost: plan.unitCost,
          quantity,
          value,
          averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
          consumptions: plan.consumptions,
        };
      }
      const costedQty = Math.min(input.quantity, Math.max(previousQty, 0));
      const uncostedQuantity = input.quantity - costedQty;
      const previousUnitCost = previousQty > 0
        ? previousValue.div(previousQty).toDecimalPlaces(MONEY_PLACES)
        : new Prisma.Decimal(0);
      const cost = costedQty === previousQty && previousQty > 0
        ? previousValue
        : previousUnitCost.mul(costedQty).toDecimalPlaces(MONEY_PLACES);
      const quantity = Math.max(0, previousQty - input.quantity);
      const value = quantity > 0 ? previousValue.sub(cost) : new Prisma.Decimal(0);
      return {
        quantityDelta: -input.quantity,
        uncostedQuantity,
        valueDelta: cost.negated(),
        unitCost: costedQty > 0 ? cost.div(costedQty).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
        quantity,
        value,
        averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
      };
    });
    if (policy.mode === 'ACTIVE' && result.uncostedQuantity > 0) {
      throw new ConflictException(
        `Costing ACTIVE menolak ${label} ${result.uncostedQuantity} unit tanpa biaya. Lengkapi backfill/opening atau matikan flag inventory.costing.`,
      );
    }
    return result;
  }

  async recordIssue(tx: Prisma.TransactionClient, input: IssueCostInput): Promise<CostingResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Quantity pengeluaran costing harus bilangan bulat positif.');
    }
    return this.recordOutbound(tx, input, 'ISSUE', 'pengeluaran');
  }

  async recordPurchaseReturn(tx: Prisma.TransactionClient, input: IssueCostInput): Promise<CostingResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Quantity retur pembelian costing harus bilangan bulat positif.');
    }
    return this.recordOutbound(tx, input, 'PURCHASE_RETURN', 'retur pembelian');
  }

  async recordReversal(tx: Prisma.TransactionClient, input: ReversalCostInput): Promise<CostingResult> {
    const original = await tx.inventoryCostEvent.findFirst({
      where: {
        id: input.reversesEventId,
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchKey: input.batchKey ?? '',
      },
    });
    if (!original) throw new BadRequestException('Event costing asal tidak ditemukan pada scope yang sama.');
    if (original.eventType !== 'ISSUE') {
      throw new BadRequestException('Reversal costing saat ini hanya mendukung event ISSUE.');
    }

    const consumptions = await tx.inventoryCostConsumption.findMany({ where: { eventId: original.id } });
    for (const consumption of consumptions) {
      const layer = await tx.inventoryCostLayer.findUnique({ where: { id: consumption.layerId } });
      if (!layer) throw new ConflictException(`Layer costing ${consumption.layerId} tidak ditemukan.`);
      const nextQty = layer.remainingQty + consumption.quantity;
      const nextValue = layer.remainingValue.add(consumption.amount);
      if (nextQty > layer.originalQty || nextValue.greaterThan(layer.originalValue)) {
        throw new ConflictException(`Reversal layer ${layer.id} melebihi quantity/value asal.`);
      }
      await tx.inventoryCostLayer.update({
        where: { id: layer.id },
        data: {
          remainingQty: nextQty,
          remainingValue: nextValue,
          status: nextQty >= layer.originalQty ? 'OPEN' : (nextQty > 0 ? 'OPEN' : layer.status),
        },
      });
    }

    const originalQuantity = Math.abs(original.quantityDelta);
    const originalCost = original.valueDelta.abs();
    const policy = await this.resolvePolicy(tx, input, input.occurredAt);
    return this.postEvent(tx, input, policy.method, 'REVERSAL', (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      const quantity = previousQty + originalQuantity;
      const value = previousValue.add(originalCost);
      return {
        quantityDelta: originalQuantity,
        uncostedQuantity: original.uncostedQuantity,
        valueDelta: originalCost,
        unitCost: originalQuantity > 0 ? originalCost.div(originalQuantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
        quantity,
        value,
        averageCost: quantity > 0 ? value.div(quantity).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
      };
    });
  }

  async previewIssue(tx: Prisma.TransactionClient, scope: CostingScope, occurredAt: Date, quantity: number) {
    const policy = await this.resolvePolicy(tx, scope, occurredAt);
    if (policy.method !== 'MOVING_AVERAGE') {
      const plan = await this.previewConsumption(tx, scope, policy.method, quantity);
      return {
        cost: plan.cost,
        unitCost: plan.unitCost,
        uncostedQuantity: plan.uncostedQuantity,
      };
    }
    const state = await this.readState(tx, scope, policy.method);
    if (!state) {
      return {
        cost: new Prisma.Decimal(0),
        unitCost: new Prisma.Decimal(0),
        uncostedQuantity: quantity,
      };
    }
    const costedQty = Math.min(quantity, Math.max(state.quantity, 0));
    const unitCost = state.quantity > 0
      ? new Prisma.Decimal(state.value).div(state.quantity).toDecimalPlaces(MONEY_PLACES)
      : new Prisma.Decimal(0);
    const cost = costedQty === state.quantity && state.quantity > 0
      ? new Prisma.Decimal(state.value)
      : unitCost.mul(costedQty).toDecimalPlaces(MONEY_PLACES);
    return {
      cost,
      unitCost: costedQty > 0 ? cost.div(costedQty).toDecimalPlaces(MONEY_PLACES) : new Prisma.Decimal(0),
      uncostedQuantity: quantity - costedQty,
    };
  }

  async state(tx: Prisma.TransactionClient, scope: CostingScope, occurredAt: Date) {
    const policy = await this.resolvePolicy(tx, scope, occurredAt);
    const state = await this.readState(tx, scope, policy.method);
    return state
      ? { ...state, method: policy.method }
      : {
        id: null,
        version: 0,
        quantity: 0,
        value: new Prisma.Decimal(0),
        averageCost: new Prisma.Decimal(0),
        method: policy.method,
      };
  }
}
