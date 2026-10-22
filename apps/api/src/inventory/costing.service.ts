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

type ComputedCost = {
  quantityDelta: number;
  uncostedQuantity: number;
  valueDelta: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  quantity: number;
  value: Prisma.Decimal;
  averageCost: Prisma.Decimal;
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
    if (policy.method !== 'MOVING_AVERAGE') {
      throw new ConflictException(`Metode costing ${policy.method} belum diaktifkan pada P0; gunakan MOVING_AVERAGE.`);
    }
    return policy;
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

  private async postEvent(
    tx: Prisma.TransactionClient,
    input: CostingScope & CostingSource,
    method: CostingPolicyRecord['method'],
    eventType: 'RECEIPT' | 'ISSUE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE',
    compute: (state: StateRecord | null) => ComputedCost,
  ): Promise<CostingResult> {
    const batchKey = input.batchKey ?? '';
    const replay = await this.existingEvent(tx, input);
    if (replay) return this.resultFromEvent(replay);

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

    const computed = compute(state);
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
    const result = await this.postEvent(tx, input, policy.method, eventType, (state) => {
      const previousQty = state?.quantity ?? 0;
      const previousValue = new Prisma.Decimal(state?.value ?? 0);
      const costedQty = Math.min(input.quantity, Math.max(previousQty, 0));
      const uncostedQuantity = input.quantity - costedQty;
      const previousUnitCost = previousQty > 0
        ? previousValue.div(previousQty).toDecimalPlaces(MONEY_PLACES)
        : new Prisma.Decimal(0);
      const cost = costedQty === previousQty && previousQty > 0
        ? previousValue
        : previousUnitCost.mul(costedQty).toDecimalPlaces(MONEY_PLACES);
      const quantity = previousQty - input.quantity;
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

  async previewIssue(tx: Prisma.TransactionClient, scope: CostingScope, occurredAt: Date, quantity: number) {
    const policy = await this.resolvePolicy(tx, scope, occurredAt);
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
    return state ?? {
      id: null,
      version: 0,
      quantity: 0,
      value: new Prisma.Decimal(0),
      averageCost: new Prisma.Decimal(0),
    };
  }
}
