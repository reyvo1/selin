import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class TransferFilesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.transferFile.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthUser, dto: { direction: string; fileName: string; status?: string }) {
    const scope = this.scope(user);
    return this.prisma.transferFile.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        direction: dto.direction.trim().toUpperCase(),
        fileName: dto.fileName.trim(),
        ...(dto.status ? { status: dto.status.trim().toUpperCase() } : {}),
      },
    });
  }
}