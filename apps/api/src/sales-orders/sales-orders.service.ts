import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class SalesOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.salesOrder.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId }, orderBy: { createdAt: 'desc' }, include: { items: true, payments: true } });
  }

  async create(user: AuthUser, dto: { customerId?: string; salespersonId?: string; items: { productId: string; quantity: number; unitPrice: number }[]; discount?: number; tax?: number; dpAmount?: number; notes?: string }) {
    const scope = this.scope(user);
    if (!dto.items?.length) throw new BadRequestException('Items wajib diisi.');
    let subtotal = 0;
    for (const it of dto.items) subtotal += it.unitPrice * it.quantity;
    const discount = dto.discount ?? 0;
    const tax = dto.tax ?? 0;
    const total = subtotal - discount + tax;
    const customer = dto.customerId ? await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId: scope.companyId }, select: { salespersonId: true } }) : null;
    const salespersonId = (dto.salespersonId?.trim() || customer?.salespersonId) ?? null;
    const order = await this.prisma.salesOrder.create({
      data: {
        companyId: scope.companyId, branchId: scope.branchId, customerId: dto.customerId, salespersonId, number: `SO-${Date.now()}`,
        subtotal, discount, tax, total, dpAmount: dto.dpAmount ?? 0, notes: dto.notes,
        items: { create: dto.items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, subtotal: it.unitPrice * it.quantity })) },
      },
      include: { items: true },
    });
    if (dto.dpAmount && dto.dpAmount > 0) {
      await this.prisma.salesOrderPayment.create({ data: { salesOrderId: order.id, amount: dto.dpAmount, method: 'DP' } });
    }
    return order;
  }

  async get(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const o = await this.prisma.salesOrder.findFirst({ where: { id, companyId: scope.companyId, branchId: scope.branchId }, include: { items: true, payments: true } });
    if (!o) throw new NotFoundException('Sales order not found');
    return o;
  }

  async settle(user: AuthUser, id: string, amount: number, method: string) {
    const scope = this.scope(user);
    const o = await this.get(user, id);
    const existingPaid = (o.payments ?? []).reduce((s, p) => s.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    const total = new Prisma.Decimal(o.total);
    const paymentAmount = new Prisma.Decimal(amount);
    if (paymentAmount.lessThanOrEqualTo(0)) throw new BadRequestException('Jumlah settle harus lebih dari 0.');
    const remaining = total.sub(existingPaid);
    if (paymentAmount.greaterThan(remaining)) throw new BadRequestException('Jumlah settle melebihi sisa tagihan.');
    await this.prisma.salesOrderPayment.create({ data: { salesOrderId: id, amount: paymentAmount, method } });
    const paid = existingPaid.add(paymentAmount);
    return this.prisma.salesOrder.update({ where: { id }, data: { settledAmount: paid, status: paid.greaterThanOrEqualTo(total) ? 'SETTLED' : 'PARTIAL' }, include: { items: true, payments: true } });
  }
}
