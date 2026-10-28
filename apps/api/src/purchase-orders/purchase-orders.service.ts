import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { nextDocumentNumber } from '../common/numbering';
import { beginIdempotent, completeIdempotent } from '../common/idempotency';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { serializableTx } from '../common/serializable-tx';
import { resolvePurchaseUnitLine, toPurchaseBaseQuantity, toPurchaseBaseUnitCost } from '../common/purchase-uom';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException('Pengguna belum memiliki company dan branch yang valid.');
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async denyTenantAccess(user: AuthUser, scope: TenantScope, entityType: string, entityId?: string): Promise<never> {
    await this.prisma.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'TENANT_ACCESS_DENIED',
        entityType,
        entityId,
        payload: { authenticatedBranchId: scope.branchId },
      },
    });
    throw new ForbiddenException(`${entityType} tidak tersedia dalam company dan branch pengguna.`);
  }

  async list(user: AuthUser, limitValue?: string, cursorValue?: string) {
    const scope = this.requireTenantScope(user);
    const limit = parsePageLimit(limitValue);
    const cursor = decodeCursor<{ createdAt: string; id: string }>(cursorValue);
    const cursorFilter: Prisma.PurchaseOrderWhereInput | undefined = cursor ? {
      OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ],
    } : undefined;
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        warehouse: {
          branchId: scope.branchId,
          branch: { companyId: scope.companyId },
        },
        supplier: { companyId: scope.companyId },
        items: { every: { product: { companyId: scope.companyId } } },
        AND: cursorFilter ? [cursorFilter] : undefined,
      },
      include: { supplier: true, warehouse: true, items: { include: { product: true } }, goodsReceipts: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return toCursorPage(rows, limit, (item) => ({ createdAt: item.createdAt.toISOString(), id: item.id }));
  }

  async findOne(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const row = await this.prisma.purchaseOrder.findFirst({
      where: {
        id,
        warehouse: {
          branchId: scope.branchId,
          branch: { companyId: scope.companyId },
        },
        supplier: { companyId: scope.companyId },
        items: { every: { product: { companyId: scope.companyId } } },
      },
      include: { supplier: true, warehouse: true, items: { include: { product: true } }, goodsReceipts: { include: { items: true } } },
    });
    if (!row) return this.denyTenantAccess(user, scope, 'PurchaseOrder', id);
    return row;
  }


  /**
   * Cancel a purchase order that was raised in error.
   *
   * This is the one lifecycle transition a PO was missing. `PurchaseOrderStatus.CANCELLED` existed in
   * the enum and the goods-receipt guard reads it, but nothing in the codebase ever wrote it, so a PO
   * raised against the wrong supplier or the wrong quantity could only be left standing — the
   * receiving guard at goods-receipts.service.ts had a branch that could never fire.
   *
   * What this deliberately does NOT do is edit the order. A PO is created APPROVED and nothing moves
   * it back to a draft, because its quantities are what a supplier is paid against. The editable
   * document is the PurchaseRequest, which carries a real DRAFT stage and its own edit guard. Adding
   * a PATCH here would either be dead code or would let someone rewrite a committed commitment, so
   * the question "the PO is wrong" is answered with a reversal, not an edit.
   *
   * Fail-closed rules, each of which is a real state this can be called in:
   *
   *   - Anything already received cannot be cancelled. Un-receiving stock is a return, not a status
   *     change, and silently flipping a PO while confirmed receipts exist would leave the ledger
   *     showing receipts against a cancelled commitment.
   *   - A confirmed receipt cannot be undone by cancelling its parent. Same reason: the stock moved.
   *   - Cancelling twice returns the same row rather than erroring, so a retried request from a flaky
   *     connection cannot fail a purchase workflow that actually succeeded.
   */
  async cancel(id: string, user: AuthUser, reason: string | undefined, idempotencyKey?: string) {
    const scope = this.requireTenantScope(user);
    const trimmedReason = reason?.trim();
    const scopeKey = idempotencyKey ? 'purchase-order:cancel' : null;
    return serializableTx(this.prisma, async (tx) => {
      if (scopeKey) {
        const gate = await beginIdempotent(tx, { companyId: scope.companyId, scope: scopeKey, key: idempotencyKey!, payload: { id, reason: trimmedReason ?? null } });
        if (gate.replay && gate.status === 'COMPLETED') return gate.response as never;
      }
      const order = await tx.purchaseOrder.findFirst({
        where: {
          id,
          warehouse: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
          supplier: { companyId: scope.companyId },
        },
        include: { goodsReceipts: { select: { operationalStatus: true } } },
      });
      if (!order) {
        // Returns `never`, so this is both the refusal and the control-flow exit. The audit record it
        // writes is what makes a cross-tenant probe visible rather than a silent 403.
        return this.denyTenantAccess(user, scope, 'PurchaseOrder', id);
      }
      if (order.status === 'CANCELLED') {
        // Already there. Returning the row keeps a retry idempotent without hiding a real refusal.
        return order;
      }
      if (order.status === 'PARTIALLY_RECEIVED' || order.status === 'RECEIVED') {
        throw new BadRequestException(`PO berstatus ${order.status}. Barang yang sudah diterima tidak dapat dibatalkan; gunakan retur atau reversal.`);
      }
      const posted = order.goodsReceipts.filter((receipt) => ['CONFIRMED', 'PARTIALLY_ACCEPTED'].includes(receipt.operationalStatus));
      if (posted.length > 0) {
        throw new BadRequestException(`PO memiliki ${posted.length} penerimaan yang sudah diposting. Batalkan lewat retur atau reversal, bukan dengan mengubah status PO.`);
      }
      // updateMany with the status in the WHERE clause is the concurrency guard: two operators racing
      // to cancel cannot both read APPROVED and both write. The second one updates zero rows.
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: order.id, status: 'APPROVED' },
        data: { status: 'CANCELLED', notes: trimmedReason ? `${order.notes ? `${order.notes}\n` : ''}Dibatalkan: ${trimmedReason}` : order.notes },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Status PO berubah saat pembatalan diproses. Muat ulang dan coba lagi.');
      }
      const updated = await tx.purchaseOrder.findUnique({ where: { id: order.id }, include: { supplier: true, warehouse: true, items: { include: { product: true } } } });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CANCEL_PURCHASE_ORDER',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          payload: { number: order.number, previousStatus: order.status, reason: trimmedReason ?? null, branchId: scope.branchId },
        },
      });
      if (scopeKey) await completeIdempotent(tx, { companyId: scope.companyId, scope: scopeKey, key: idempotencyKey!, resourceType: 'PurchaseOrder', resourceId: order.id, response: updated });
      return updated;
    });
  }

  async create(dto: CreatePurchaseOrderDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    if (!dto.items.length) throw new BadRequestException('Purchase order harus memiliki minimal satu barang.');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        branchId: scope.branchId,
        branch: { companyId: scope.companyId },
      },
      select: { id: true },
    });
    if (!warehouse) return this.denyTenantAccess(user, scope, 'Warehouse', dto.warehouseId);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, companyId: scope.companyId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      const supplierExists = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId }, select: { id: true } });
      if (supplierExists) return this.denyTenantAccess(user, scope, 'Supplier', dto.supplierId);
      throw new BadRequestException('Supplier tidak ditemukan.');
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, companyId: scope.companyId, isActive: true },
      select: { id: true, unit: true },
    });
    if (products.length !== productIds.length) {
      const accepted = new Set(products.map((product) => product.id));
      const missingIds = productIds.filter((id) => !accepted.has(id));
      const crossTenant = await this.prisma.product.findFirst({ where: { id: { in: missingIds } }, select: { id: true } });
      if (crossTenant) return this.denyTenantAccess(user, scope, 'Product', crossTenant.id);
      throw new BadRequestException('Satu atau lebih produk tidak ditemukan.');
    }
    const productById = new Map(products.map((product) => [product.id, product]));

    const preparedItems: Array<{
      productId: string; variantId: string | null; productUnitId: string | null; unitCode: string | null;
      unitQuantity: number; quantityFactor: number; orderedQty: number; unitCost: Prisma.Decimal;
      purchaseUnitCost: Prisma.Decimal; subtotal: Prisma.Decimal;
    }> = [];
    for (const item of dto.items) {
      const product = productById.get(item.productId)!;
      const uom = await resolvePurchaseUnitLine(this.prisma, scope, product, {
        productUnitId: item.productUnitId,
        variantId: item.variantId,
        barcodeCode: item.barcodeCode,
      });
      const baseQuantity = toPurchaseBaseQuantity(item.orderedQty, uom.quantityFactor);
      const purchaseUnitCost = new Prisma.Decimal(item.unitCost);
      const baseUnitCost = toPurchaseBaseUnitCost(purchaseUnitCost, uom.quantityFactor);
      preparedItems.push({
        productId: item.productId, variantId: uom.variantId, productUnitId: uom.productUnitId, unitCode: uom.unitCode,
        unitQuantity: item.orderedQty, quantityFactor: uom.quantityFactor, orderedQty: baseQuantity,
        unitCost: baseUnitCost, purchaseUnitCost,
        subtotal: purchaseUnitCost.mul(item.orderedQty),
      });
    }
    const subtotal = preparedItems.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
    const scopeKey = dto.idempotencyKey ? 'purchase-order:create' : null;
    const result = await serializableTx(this.prisma, async (tx) => {
      if (scopeKey) {
        const gate = await beginIdempotent(tx, { companyId: scope.companyId, scope: scopeKey, key: dto.idempotencyKey!, payload: dto });
        if (gate.replay && gate.status === 'COMPLETED') return gate.response as never;
      }
      const order = await tx.purchaseOrder.create({
        data: {
          number: await nextDocumentNumber(tx, { companyId: user.companyId!, branchId: user.branchId!, documentType: 'PURCHASE_ORDER', prefix: 'PO' }), supplierId: dto.supplierId, warehouseId: warehouse.id,
          status: 'APPROVED', expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
          subtotal, total: subtotal, notes: dto.notes, taxIncluded: dto.taxIncluded ?? false,
          items: { create: preparedItems.map((item) => ({
            productId: item.productId, variantId: item.variantId, productUnitId: item.productUnitId,
            unitCode: item.unitCode, unitQuantity: item.unitQuantity, quantityFactor: item.quantityFactor,
            orderedQty: item.orderedQty, unitCost: item.unitCost, purchaseUnitCost: item.purchaseUnitCost, subtotal: item.subtotal,
          })) },
        },
        include: { supplier: true, warehouse: true, items: { include: { product: true } } },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_PURCHASE_ORDER',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          payload: dto as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.supplierPriceHistory.createMany({
        data: preparedItems.map((item) => ({
          companyId: scope.companyId,
          branchId: scope.branchId,
          supplierId: dto.supplierId,
          productId: item.productId,
          field: 'purchaseUnitCost',
          oldValue: null,
          newValue: item.purchaseUnitCost,
          changedById: user.sub,
        })),
      });
      if (scopeKey) await completeIdempotent(tx, { companyId: scope.companyId, scope: scopeKey, key: dto.idempotencyKey!, resourceType: 'PurchaseOrder', resourceId: order.id, response: order });
      return order;
    });
    return result;
  }
}
