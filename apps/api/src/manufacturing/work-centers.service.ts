import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class WorkCentersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.workCenter.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId }, orderBy: { code: 'asc' } });
  }

  async create(user: AuthUser, dto: { code: string; name: string; hourlyRate?: number }) {
    const scope = this.scope(user);
    return this.prisma.workCenter.create({ data: { companyId: scope.companyId, branchId: scope.branchId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), hourlyRate: dto.hourlyRate ?? 0 } });
  }

  async update(user: AuthUser, id: string, dto: { name?: string; hourlyRate?: number; isActive?: boolean }) {
    const scope = this.scope(user);
    const existing = await this.prisma.workCenter.findFirst({ where: { id, companyId: scope.companyId, branchId: scope.branchId } });
    if (!existing) throw new NotFoundException('Work center not found');
    return this.prisma.workCenter.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.hourlyRate !== undefined ? { hourlyRate: dto.hourlyRate } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } });
  }
}
