import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class CashFlowCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.cashFlowCategory.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { code: 'asc' },
    });
  }

  async create(user: AuthUser, dto: { code: string; name: string; kind?: string }) {
    const scope = this.scope(user);
    return this.prisma.cashFlowCategory.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        kind: dto.kind?.trim() || 'OPERATING',
      },
    });
  }

  async update(user: AuthUser, id: string, dto: { name?: string; kind?: string; isActive?: boolean }) {
    const scope = this.scope(user);
    const existing = await this.prisma.cashFlowCategory.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!existing) throw new NotFoundException('Cash flow category not found');
    return this.prisma.cashFlowCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}