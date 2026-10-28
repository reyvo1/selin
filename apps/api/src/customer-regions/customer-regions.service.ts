import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class CustomerRegionsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.customerRegion.findMany({ where: { companyId: scope.companyId }, orderBy: { code: 'asc' } });
  }

  async create(user: AuthUser, dto: { code: string; name: string; discountPct?: number; isActive?: boolean }) {
    const scope = this.scope(user);
    return this.prisma.customerRegion.create({
      data: {
        companyId: scope.companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        discountPct: dto.discountPct ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: { code?: string; name?: string; discountPct?: number; isActive?: boolean }) {
    const scope = this.scope(user);
    const existing = await this.prisma.customerRegion.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Customer region not found');
    return this.prisma.customerRegion.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.discountPct !== undefined ? { discountPct: dto.discountPct } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
