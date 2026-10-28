import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.consignmentOrder.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    user: AuthUser,
    dto: { supplierId?: string; customerId?: string; number?: string } = {},
  ) {
    const scope = this.scope(user);
    const number = (dto?.number ?? `CON-${Date.now()}`).trim();
    if (!number) throw new BadRequestException('number wajib diisi.');

    return this.prisma.consignmentOrder.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        supplierId: dto?.supplierId?.trim() || undefined,
        customerId: dto?.customerId?.trim() || undefined,
        number,
        status: 'DRAFT',
      },
    });
  }

  async settle(user: AuthUser, id: string, amount: unknown) {
    const scope = this.scope(user);
    const order = await this.prisma.consignmentOrder.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!order) throw new NotFoundException('Consignment order not found');

    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(String(amount ?? ''));
      if (!decimal.isFinite() || decimal.lessThanOrEqualTo(0)) throw new Error('invalid');
      decimal = decimal.toDecimalPlaces(2);
    } catch {
      throw new BadRequestException('amount tidak valid.');
    }

    await this.prisma.consignmentSettlement.create({
      data: { consignmentOrderId: id, amount: decimal },
    });

    return this.prisma.consignmentOrder.update({
      where: { id },
      data: { status: 'SETTLED' },
    });
  }
}