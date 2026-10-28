import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

export type NumberSequenceDto = {
  companyId?: string;
  branchId?: string | null;
  documentType: string;
  prefix?: string;
  format?: string;
  padding?: number;
  resetPolicy?: 'MONTHLY' | 'YEARLY' | 'NEVER';
};

@Injectable()
export class NumberSequencesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId };
  }

  async list(user: AuthUser, companyId?: string, branchId?: string, documentType?: string) {
    const scopeCompanyId = companyId || this.scope(user).companyId;
    // tenant safety: non-super users are limited to their own company
    if (user.companyId && scopeCompanyId !== user.companyId) throw new NotFoundException('Company not accessible');
    return this.prisma.numberSequence.findMany({
      where: {
        companyId: scopeCompanyId,
        ...(branchId !== undefined ? { branchId: branchId || null } : {}),
        ...(documentType ? { documentType } : {}),
      },
      orderBy: [{ documentType: 'asc' }, { branchId: 'asc' }],
    });
  }

  async upsert(user: AuthUser, dto: NumberSequenceDto) {
    const scope = this.scope(user);
    const companyId = dto.companyId || scope.companyId;
    if (companyId !== scope.companyId && !(user.roles ?? []).includes('SUPER_ADMIN')) throw new NotFoundException('Company not accessible');
    const branchId = dto.branchId ?? null;
    const documentType = dto.documentType.trim().toUpperCase();
    const existing = await this.prisma.numberSequence.findFirst({
      where: { companyId, branchId, documentType },
    });
    const data = {
      prefix: (dto.prefix ?? existing?.prefix ?? documentType).trim(),
      format: (dto.format ?? existing?.format ?? '{PREFIX}-{SCOPE}-{YYYY}{MM}-{NUMBER}').trim(),
      padding: dto.padding ?? existing?.padding ?? 6,
      resetPolicy: dto.resetPolicy ?? existing?.resetPolicy ?? 'MONTHLY',
    };
    if (existing) {
      return this.prisma.numberSequence.update({ where: { id: existing.id }, data });
    }
    return this.prisma.numberSequence.create({
      data: { companyId, branchId, documentType, ...data, nextNumber: 1 },
    });
  }

  async update(user: AuthUser, id: string, dto: Partial<NumberSequenceDto>) {
    const scope = this.scope(user);
    const existing = await this.prisma.numberSequence.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Number sequence not found');
    return this.prisma.numberSequence.update({
      where: { id },
      data: {
        ...(dto.prefix !== undefined ? { prefix: dto.prefix.trim() } : {}),
        ...(dto.format !== undefined ? { format: dto.format.trim() } : {}),
        ...(dto.padding !== undefined ? { padding: dto.padding } : {}),
        ...(dto.resetPolicy !== undefined ? { resetPolicy: dto.resetPolicy } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      },
    });
  }
}
