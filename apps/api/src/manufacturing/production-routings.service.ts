import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class ProductionRoutingsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId };
  }

  async list(user: AuthUser, recipeId?: string) {
    const scope = this.scope(user);
    return this.prisma.productionRouting.findMany({
      where: { companyId: scope.companyId, ...(recipeId ? { recipeId } : {}), isActive: true },
      orderBy: [{ recipeId: 'asc' }, { version: 'desc' }],
    });
  }

  async create(user: AuthUser, dto: { recipeId: string; operations: unknown[] }) {
    const scope = this.scope(user);
    const latest = await this.prisma.productionRouting.findFirst({ where: { companyId: scope.companyId, recipeId: dto.recipeId }, orderBy: { version: 'desc' } });
    return this.prisma.productionRouting.create({
      data: { companyId: scope.companyId, recipeId: dto.recipeId, version: (latest?.version ?? 0) + 1, operations: dto.operations as any },
    });
  }
}
