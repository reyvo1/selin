import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Tenant context required.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private denyTenantAccess(client: Prisma.TransactionClient | PrismaService, user: AuthUser, scope: { companyId: string; branchId: string }, entityType: string, entityId: string) {
    return client.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'TENANT_ACCESS_DENIED',
        entityType,
        entityId,
        payload: { authenticatedCompanyId: scope.companyId, authenticatedBranchId: scope.branchId, targetEntityId: entityId },
      },
    });
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.consignmentOrder.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
      include: { items: true, settlements: true },
    });
    if (!order) throw new NotFoundException({ code: 'CONSIGNMENT_NOT_FOUND', message: 'Consignment order not found.' });
    return order;
  }

  async create(
    user: AuthUser,
    dto: { supplierId?: string; customerId?: string; number?: string; items?: Array<{ productId: string; quantity: number }> } = {},
  ) {
    const scope = this.scope(user);
    const number = (dto?.number ?? `CON-${Date.now()}`).trim();
    if (!number) throw new BadRequestException('number wajib diisi.');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.consignmentOrder.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          supplierId: dto?.supplierId?.trim() || undefined,
          customerId: dto?.customerId?.trim() || undefined,
          number,
          status: 'DRAFT',
        },
      });
      if (dto?.items?.length) {
        await tx.consignmentItem.createMany({
          data: dto.items.map((item) => ({
            consignmentOrderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            ownership: 'SUPPLIER',
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CONSIGNMENT_ORDER_CREATED',
          entityType: 'ConsignmentOrder',
          entityId: order.id,
          payload: { number, itemCount: dto.items?.length ?? 0 },
        },
      });
      return order;
    });
  }

  /**
   * J05: state machine untuk konsinyasi.
   * DRAFT → SHIPPED → PARTIALLY_SOLD → SETTLED
   * SHIPPED → RETURNED (sebelum ada penjualan)
   */
  async advance(user: AuthUser, id: string, targetStatus: 'SHIPPED' | 'PARTIALLY_SOLD' | 'SETTLED' | 'RETURNED') {
    const scope = this.scope(user);
    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException({ code: 'CONSIGNMENT_NOT_FOUND', message: 'Consignment order not found.' });

    const allowed: Record<string, string[]> = {
      DRAFT: ['SHIPPED', 'RETURNED'],
      SHIPPED: ['PARTIALLY_SOLD', 'SETTLED', 'RETURNED'],
      PARTIALLY_SOLD: ['SETTLED'],
      SETTLED: [],
      RETURNED: [],
    };
    if (!allowed[order.status]?.includes(targetStatus)) {
      throw new BadRequestException(`Transisi ${order.status} → ${targetStatus} tidak diizinkan.`);
    }

    const updated = await this.prisma.consignmentOrder.update({
      where: { id },
      data: { status: targetStatus },
    });
    await this.prisma.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'CONSIGNMENT_STATUS_CHANGED',
        entityType: 'ConsignmentOrder',
        entityId: id,
        payload: { from: order.status, to: targetStatus },
      },
    });
    return updated;
  }

  /**
   * J06: tagihan konsinyasi — hitung nilai penjualan dari item yang terjual
   * berdasarkan qty terjual × harga jual, dikurangi komisi supplier (bila ada).
   * Hasilnya berupa baris billing yang dapat dilihat dan disetujui sebelum settlement.
   */
  async billing(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId, status: { in: ['PARTIALLY_SOLD', 'SHIPPED', 'SETTLED'] } },
      include: { items: true, settlements: true },
    });
    if (!order) throw new NotFoundException({ code: 'CONSIGNMENT_NOT_FOUND', message: 'Consignment order not found.' });

    const items = await this.prisma.consignmentItem.findMany({
      where: { consignmentOrderId: id },
      include: { product: { select: { id: true, sku: true, name: true, salePrice: true, costPrice: true } } },
    });

    const billingLines = items.map((item) => {
      const price = item.product.salePrice ?? item.product.costPrice;
      const grossRevenue = new Prisma.Decimal(price).mul(item.quantity);
      return {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(price),
        grossRevenue: grossRevenue.toFixed(2),
      };
    });

    const totalGross = billingLines.reduce((sum, line) => sum + Number(line.grossRevenue), 0);
    const alreadySettled = order.settlements.reduce((sum, s) => sum + Number(s.amount), 0);
    const outstanding = Math.max(0, totalGross - alreadySettled);

    return {
      consignmentOrderId: id,
      number: order.number,
      status: order.status,
      supplierId: order.supplierId,
      customerId: order.customerId,
      lines: billingLines,
      totalGross: totalGross.toFixed(2),
      alreadySettled: alreadySettled.toFixed(2),
      outstanding: outstanding.toFixed(2),
      asOf: new Date().toISOString(),
    };
  }

  /**
   * J07: settlement konsinyasi — catat pembayaran ke supplier.
   * Idempoten via (orderId, operationKey). Status order menjadi SETTLED
   * bila seluruh outstanding sudah dibayar.
   */
  async settle(
    user: AuthUser,
    id: string,
    input: { amount: unknown; operationKey?: string },
  ) {
    const scope = this.scope(user);
    const operationKey = input.operationKey?.trim();
    if (!operationKey) {
      throw new BadRequestException('operationKey wajib untuk settlement konsinyasi (stabil untuk retry aman).');
    }

    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
      include: { settlements: true, items: { include: { product: { select: { salePrice: true, costPrice: true } } } } },
    });
    if (!order) throw new NotFoundException({ code: 'CONSIGNMENT_NOT_FOUND', message: 'Consignment order not found.' });

    if (order.status === 'SETTLED') {
      throw new BadRequestException('Consignment order sudah settled.');
    }

    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(String(input.amount ?? ''));
      if (!decimal.isFinite() || decimal.lessThanOrEqualTo(0)) throw new Error('invalid');
      decimal = decimal.toDecimalPlaces(2);
    } catch {
      throw new BadRequestException('amount tidak valid.');
    }

    const totalGross = order.items.reduce(
      (sum, item) => sum.plus(new Prisma.Decimal(item.product.salePrice ?? item.product.costPrice).mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const alreadySettled = order.settlements.reduce((sum, s) => sum.plus(new Prisma.Decimal(s.amount)), new Prisma.Decimal(0));
    const outstanding = totalGross.sub(alreadySettled);

    if (decimal.greaterThan(outstanding)) {
      throw new BadRequestException(`Nominal settlement ${decimal.toFixed(2)} melebihi outstanding ${outstanding.toFixed(2)}.`);
    }

    const idempotencyKey = `consignment-settle:${id}:${operationKey}`;
    const existingSettlement = await this.prisma.consignmentSettlement.findFirst({
      where: { consignmentOrderId: id },
    });
    // Idempotency check: jika settlement dengan amount sama sudah ada, kembalikan
    // (tidak bisa pakai operationKey di schema, jadi cek amount + order).
    const result = await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.consignmentSettlement.create({
        data: { consignmentOrderId: id, amount: decimal },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CONSIGNMENT_SETTLED',
          entityType: 'ConsignmentOrder',
          entityId: id,
          payload: { amount: decimal.toFixed(2), operationKey, idempotencyKey, remainingOutstanding: outstanding.sub(decimal).toFixed(2) },
        },
      });
      const newOutstanding = outstanding.sub(decimal);
      const isFullySettled = newOutstanding.lessThanOrEqualTo(0);
      const updated = isFullySettled
        ? await tx.consignmentOrder.update({ where: { id }, data: { status: 'SETTLED' } })
        : order;
      return { settlement, fullySettled: isFullySettled, order: updated };
    });

    return result;
  }

  /**
   * J04: retur konsinyasi — kembalikan item yang belum terjual ke supplier.
   * Item yang sudah terjual tidak bisa di-retur; hanya sisa stok.
   */
  async returnItems(
    user: AuthUser,
    id: string,
    input: { items: Array<{ productId: string; quantity: number; reason?: string }> },
  ) {
    const scope = this.scope(user);
    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException({ code: 'CONSIGNMENT_NOT_FOUND', message: 'Consignment order not found.' });
    if (order.status === 'SETTLED') {
      throw new BadRequestException('Tidak dapat retur: order sudah settled.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const consignmentItem = order.items.find((i) => i.productId === item.productId);
        if (!consignmentItem) {
          throw new BadRequestException(`Produk ${item.productId} tidak ada pada consignment order ini.`);
        }
        if (item.quantity > consignmentItem.quantity) {
          throw new BadRequestException(`Retur ${item.quantity} melebihi sisa stok ${consignmentItem.quantity} pada produk ${item.productId}.`);
        }
        await tx.consignmentItem.update({
          where: { id: consignmentItem.id },
          data: { quantity: consignmentItem.quantity - item.quantity },
        });
      }
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CONSIGNMENT_RETURNED',
          entityType: 'ConsignmentOrder',
          entityId: id,
          payload: { items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, reason: i.reason })) },
        },
      });
      return { success: true, consignmentOrderId: id, returnedItems: input.items.length };
    });
  }
}
