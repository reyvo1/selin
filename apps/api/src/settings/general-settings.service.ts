import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

export type GeneralSettingDto = {
  companyId?: string;
  branchId?: string | null;
  namespace?: string;
  key: string;
  value: unknown;
  isSecret?: boolean;
};

const GENERAL_NAMESPACE = 'general';

@Injectable()
export class GeneralSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId };
  }

  async list(user: AuthUser, companyId?: string, namespace?: string) {
    const scopeCompanyId = companyId || this.scope(user).companyId;
    if (user.companyId && scopeCompanyId !== user.companyId) throw new NotFoundException('Company not accessible');
    const targetNamespace = namespace ?? GENERAL_NAMESPACE;
    return this.prisma.systemSetting.findMany({
      where: {
        companyId: scopeCompanyId,
        ...(targetNamespace ? { namespace: targetNamespace } : {}),
      },
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async get(user: AuthUser, key: string, namespace?: string) {
    const scope = this.scope(user);
    const targetNamespace = namespace ?? GENERAL_NAMESPACE;
    return this.prisma.systemSetting.findFirst({
      where: { companyId: scope.companyId, namespace: targetNamespace, key },
    });
  }

  async upsert(user: AuthUser, dto: GeneralSettingDto) {
    const scope = this.scope(user);
    const companyId = dto.companyId || scope.companyId;
    if (companyId !== scope.companyId && !(user.roles ?? []).includes('SUPER_ADMIN')) {
      throw new NotFoundException('Company not accessible');
    }
    const namespace = (dto.namespace ?? GENERAL_NAMESPACE).trim() || GENERAL_NAMESPACE;
    const key = dto.key.trim();
    if (!key) throw new BadRequestException('Key general setting wajib diisi.');
    const branchId = dto.branchId ?? null;

    if (namespace === GENERAL_NAMESPACE && key === 'timezone' && typeof dto.value === 'string') {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: dto.value }).format(new Date());
      } catch {
        throw new BadRequestException('Timezone IANA tidak valid.');
      }
    }
    if (namespace === GENERAL_NAMESPACE && key === 'locale' && typeof dto.value === 'string') {
      try {
        new Intl.DateTimeFormat(dto.value).format(new Date());
      } catch {
        throw new BadRequestException('Locale tidak valid.');
      }
    }
    if (namespace === GENERAL_NAMESPACE && key === 'currency' && typeof dto.value === 'string') {
      if (!/^[A-Za-z]{3}$/.test(dto.value)) throw new BadRequestException('Currency harus 3 huruf.');
    }

    const existing = await this.prisma.systemSetting.findFirst({
      where: { companyId, branchId, userId: null, namespace, key },
    });
    const data = {
      companyId,
      branchId,
      userId: null,
      namespace,
      key,
      value: dto.value as any,
      isSecret: dto.isSecret ?? existing?.isSecret ?? false,
    };
    if (existing) {
      return this.prisma.systemSetting.update({ where: { id: existing.id }, data });
    }
    return this.prisma.systemSetting.create({ data });
  }

  async update(user: AuthUser, id: string, dto: Partial<GeneralSettingDto>) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('General setting not found');
    return this.prisma.systemSetting.update({
      where: { id },
      data: {
        ...(dto.key !== undefined ? { key: dto.key.trim() } : {}),
        ...(dto.namespace !== undefined ? { namespace: dto.namespace.trim() } : {}),
        ...(dto.value !== undefined ? { value: dto.value as any } : {}),
        ...(dto.isSecret !== undefined ? { isSecret: dto.isSecret } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      },
    });
  }
}
