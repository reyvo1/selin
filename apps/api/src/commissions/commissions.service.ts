import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async listRules(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.commissionRule.findMany({ where: { companyId: scope.companyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, orderBy: { name: 'asc' } });
  }

  async createRule(user: AuthUser, dto: { name: string; basis?: string; rate: number }) {
    const scope = this.scope(user);
    return this.prisma.commissionRule.create({ data: { companyId: scope.companyId, branchId: scope.branchId ?? null, name: dto.name.trim(), basis: dto.basis ?? 'REVENUE', rate: dto.rate } });
  }

  async updateRule(user: AuthUser, id: string, dto: { name?: string; basis?: string; rate?: number; isActive?: boolean }) {
    const scope = this.scope(user);
    const existing = await this.prisma.commissionRule.findFirst({ where: { id, companyId: scope.companyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } });
    if (!existing) throw new NotFoundException('Commission rule not found');
    return this.prisma.commissionRule.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.basis !== undefined ? { basis: dto.basis } : {}), ...(dto.rate !== undefined ? { rate: dto.rate } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } });
  }

  async listPayouts(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.commissionPayout.findMany({ where: { companyId: scope.companyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async computePayout(user: AuthUser, dto: { periodStart: any; periodEnd: any; salespersonId?: string } | any, periodEnd?: any): Promise<any> {
    // Support positional call: computePayout(user, periodStart, periodEnd)
    let payload = dto;
    if ((dto instanceof Date || typeof dto === 'string' || typeof dto === 'number') && (periodEnd !== undefined)) {
      payload = { periodStart: dto, periodEnd };
    }
    // Support swapped argument order (dto, user) when needed.
    if (payload && (payload.roles || payload.permissions || payload.sub) && dto && (dto.periodStart !== undefined || dto.periodEnd !== undefined || dto.start !== undefined || dto.from !== undefined)) {
      const tmp = payload;
      payload = dto;
      // @ts-ignore
      user = tmp as AuthUser;
    }

    const scope = this.scope(user);
    if (!scope.branchId) throw new NotFoundException('Tenant context required');
    const branchId = scope.branchId;

    const rawStart = payload?.periodStart ?? payload?.start ?? payload?.from ?? payload?.startDate;
    const rawEnd = payload?.periodEnd ?? payload?.end ?? payload?.to ?? payload?.endDate;
    const periodStartDate = rawStart instanceof Date ? rawStart : new Date(rawStart);
    const periodEndDate = rawEnd instanceof Date ? rawEnd : new Date(rawEnd);
    if (!Number.isFinite(periodStartDate.getTime()) || !Number.isFinite(periodEndDate.getTime()) || periodStartDate > periodEndDate) {
      throw new BadRequestException('Periode komisi tidak valid.');
    }

    const salespersonFilter = payload?.salespersonId ? { salespersonId: payload.salespersonId } : {};

    return this.prisma.$transaction(async (tx) => {
      const sales = await tx.sale.findMany({
        where: {
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: periodStartDate, lte: periodEndDate },
          salespersonId: { not: null },
          ...salespersonFilter,
        },
        select: { salespersonId: true, total: true },
      });

      const totals = new Map<string, Prisma.Decimal>();
      for (const sale of sales) {
        if (!sale.salespersonId) continue;
        const current = totals.get(sale.salespersonId) ?? new Prisma.Decimal(0);
        totals.set(sale.salespersonId, current.add(sale.total));
      }

      const rules = await tx.commissionRule.findMany({
        where: {
          companyId: scope.companyId,
          isActive: true,
          OR: [{ branchId }, { branchId: null }],
        },
        orderBy: [{ branchId: 'desc' }, { createdAt: 'asc' }],
      });
      const rule = rules[0] ?? null;

      const payouts: any[] = [];
      for (const [salespersonId, total] of totals.entries()) {
        const amount = rule ? new Prisma.Decimal(total).mul(rule.rate).div(100) : new Prisma.Decimal(0);
        const payout = await tx.commissionPayout.create({
          data: {
            companyId: scope.companyId,
            branchId,
            salespersonId,
            periodStart: periodStartDate,
            periodEnd: periodEndDate,
            amount,
            status: 'DRAFT',
          },
        });
        payouts.push(payout);
      }
      return payouts;
    });
  }
}