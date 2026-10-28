import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { randomUUID } from 'crypto';

const PRINTER_NAMESPACE = 'printer';
const PRINT_JOB_NAMESPACE = 'print_job';

export type PrinterType = 'thermal_usb' | 'thermal_bluetooth' | 'rawbt' | 'browser';
export type PrinterConnection = 'usb' | 'bluetooth' | 'rawbt' | 'browser';
export type PrintJobStatus = 'queued' | 'printing' | 'printed' | 'failed';

export type PrinterConfig = {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  station: string | null;
  type: PrinterType;
  connection: PrinterConnection;
  paperWidth: 58 | 80;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PrintJob = {
  id: string;
  companyId: string;
  branchId: string | null;
  printerId: string | null;
  printerName: string | null;
  documentType: string;
  referenceId: string | null;
  payload: string | null;
  status: PrintJobStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  printedAt: string | null;
};

function asPrinter(setting: any): PrinterConfig {
  const v = (setting.value ?? {}) as any;
  return {
    id: setting.id,
    companyId: setting.companyId,
    branchId: setting.branchId ?? null,
    name: v.name ?? setting.key,
    station: v.station ?? null,
    type: (v.type as PrinterType) ?? 'rawbt',
    connection: (v.connection as PrinterConnection) ?? 'rawbt',
    paperWidth: (v.paperWidth === 80 ? 80 : 58) as 58 | 80,
    isDefault: Boolean(v.isDefault),
    isActive: v.isActive !== false,
    createdAt: setting.createdAt?.toISOString?.() ?? String(setting.createdAt),
    updatedAt: setting.updatedAt?.toISOString?.() ?? String(setting.updatedAt),
  };
}

function asJob(setting: any): PrintJob {
  const v = (setting.value ?? {}) as any;
  return {
    id: setting.id,
    companyId: setting.companyId,
    branchId: setting.branchId ?? null,
    printerId: v.printerId ?? null,
    printerName: v.printerName ?? null,
    documentType: v.documentType ?? 'RECEIPT',
    referenceId: v.referenceId ?? null,
    payload: v.payload ?? null,
    status: (v.status as PrintJobStatus) ?? 'queued',
    attempts: Number(v.attempts ?? 0),
    error: v.error ?? null,
    createdAt: setting.createdAt?.toISOString?.() ?? String(setting.createdAt),
    updatedAt: setting.updatedAt?.toISOString?.() ?? String(setting.updatedAt),
    printedAt: v.printedAt ?? null,
  };
}

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    return { companyId: user.companyId };
  }

  // ---------- printers ----------
  async listPrinters(user: AuthUser, companyId?: string, branchId?: string) {
    const scopeCompanyId = companyId || this.scope(user).companyId;
    if (user.companyId && scopeCompanyId !== user.companyId) throw new NotFoundException('Company not accessible');
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        companyId: scopeCompanyId,
        namespace: PRINTER_NAMESPACE,
        ...(branchId !== undefined ? { branchId: branchId || null } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map(asPrinter);
  }

  async createPrinter(user: AuthUser, dto: any) {
    const scope = this.scope(user);
    const companyId = dto?.companyId || scope.companyId;
    if (companyId !== scope.companyId && !(user.roles ?? []).includes('SUPER_ADMIN')) {
      throw new NotFoundException('Company not accessible');
    }
    const name = String(dto?.name ?? '').trim();
    if (!name) throw new BadRequestException('Nama printer wajib diisi.');
    const branchId = dto?.branchId ?? null;
    const paperWidth = dto?.paperWidth === 80 ? 80 : 58;
    const type = (dto?.type as PrinterType) ?? 'rawbt';
    const connection = (dto?.connection as PrinterConnection) ?? 'rawbt';
    const id = randomUUID();
    const created = await this.prisma.systemSetting.create({
      data: {
        companyId,
        branchId,
        userId: null,
        namespace: PRINTER_NAMESPACE,
        key: id,
        value: {
          name,
          station: dto?.station ? String(dto.station).trim() : null,
          type,
          connection,
          paperWidth,
          isDefault: Boolean(dto?.isDefault),
          isActive: dto?.isActive !== false,
        } as any,
        isSecret: false,
      },
    });
    return asPrinter(created);
  }

  async updatePrinter(user: AuthUser, id: string, dto: any) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({
      where: { id, companyId: scope.companyId, namespace: PRINTER_NAMESPACE },
    });
    if (!existing) throw new NotFoundException('Printer not found');
    const v = (existing.value ?? {}) as any;
    const next = {
      name: dto?.name !== undefined ? String(dto.name).trim() : v.name,
      station: dto?.station !== undefined ? (dto.station ? String(dto.station).trim() : null) : v.station,
      type: dto?.type !== undefined ? dto.type : v.type,
      connection: dto?.connection !== undefined ? dto.connection : v.connection,
      paperWidth: dto?.paperWidth !== undefined ? (dto.paperWidth === 80 ? 80 : 58) : v.paperWidth,
      isDefault: dto?.isDefault !== undefined ? Boolean(dto.isDefault) : v.isDefault,
      isActive: dto?.isActive !== undefined ? Boolean(dto.isActive) : v.isActive,
    };
    if (!next.name) throw new BadRequestException('Nama printer wajib diisi.');
    const updated = await this.prisma.systemSetting.update({
      where: { id },
      data: {
        ...(dto?.branchId !== undefined ? { branchId: dto.branchId } : {}),
        value: next as any,
      },
    });
    return asPrinter(updated);
  }

  async deletePrinter(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({
      where: { id, companyId: scope.companyId, namespace: PRINTER_NAMESPACE },
    });
    if (!existing) throw new NotFoundException('Printer not found');
    await this.prisma.systemSetting.delete({ where: { id } });
    return { id, deleted: true };
  }

  async getDefaultPrinter(user: AuthUser, branchId?: string) {
    const list = await this.listPrinters(user, undefined, branchId);
    return list.find((p) => p.isDefault && p.isActive) ?? list.find((p) => p.isActive) ?? null;
  }

  // ---------- print jobs ----------
  async listJobs(user: AuthUser, companyId?: string, branchId?: string, status?: string, printerId?: string) {
    const scopeCompanyId = companyId || this.scope(user).companyId;
    if (user.companyId && scopeCompanyId !== user.companyId) throw new NotFoundException('Company not accessible');
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        companyId: scopeCompanyId,
        namespace: PRINT_JOB_NAMESPACE,
        ...(branchId !== undefined ? { branchId: branchId || null } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    let jobs = rows.map(asJob);
    if (status) jobs = jobs.filter((j) => j.status === status);
    if (printerId) jobs = jobs.filter((j) => j.printerId === printerId);
    return jobs;
  }

  async createJob(user: AuthUser, dto: any) {
    const scope = this.scope(user);
    const companyId = dto?.companyId || scope.companyId;
    if (companyId !== scope.companyId && !(user.roles ?? []).includes('SUPER_ADMIN')) {
      throw new NotFoundException('Company not accessible');
    }
    const printerId = dto?.printerId ? String(dto.printerId) : null;
    let printerName: string | null = null;
    if (printerId) {
      const p = await this.prisma.systemSetting.findFirst({
        where: { id: printerId, companyId, namespace: PRINTER_NAMESPACE },
      });
      if (p) printerName = asPrinter(p).name;
    }
    const id = randomUUID();
    const created = await this.prisma.systemSetting.create({
      data: {
        companyId,
        branchId: dto?.branchId ?? null,
        userId: null,
        namespace: PRINT_JOB_NAMESPACE,
        key: id,
        value: {
          printerId,
          printerName,
          documentType: dto?.documentType ? String(dto.documentType).trim().toUpperCase() : 'RECEIPT',
          referenceId: dto?.referenceId ? String(dto.referenceId) : null,
          payload: dto?.payload ? String(dto.payload) : null,
          status: 'queued' as PrintJobStatus,
          attempts: 0,
          error: null,
          printedAt: null,
        } as any,
        isSecret: false,
      },
    });
    return asJob(created);
  }

  async updateJobStatus(user: AuthUser, id: string, dto: any) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({
      where: { id, companyId: scope.companyId, namespace: PRINT_JOB_NAMESPACE },
    });
    if (!existing) throw new NotFoundException('Print job not found');
    const v = (existing.value ?? {}) as any;
    const status = (dto?.status as PrintJobStatus) ?? v.status ?? 'queued';
    const next = {
      ...v,
      status,
      error: dto?.error !== undefined ? (dto.error ? String(dto.error) : null) : v.error,
      attempts: dto?.attempts !== undefined ? Number(dto.attempts) : v.attempts,
      printedAt: status === 'printed' ? (v.printedAt ?? new Date().toISOString()) : v.printedAt,
    };
    const updated = await this.prisma.systemSetting.update({
      where: { id },
      data: { value: next as any },
    });
    return asJob(updated);
  }

  async retryJob(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({
      where: { id, companyId: scope.companyId, namespace: PRINT_JOB_NAMESPACE },
    });
    if (!existing) throw new NotFoundException('Print job not found');
    const v = (existing.value ?? {}) as any;
    const next = {
      ...v,
      status: 'queued' as PrintJobStatus,
      error: null,
      attempts: Number(v.attempts ?? 0) + 1,
    };
    const updated = await this.prisma.systemSetting.update({
      where: { id },
      data: { value: next as any },
    });
    return asJob(updated);
  }

  async deleteJob(user: AuthUser, id: string) {
    const scope = this.scope(user);
    const existing = await this.prisma.systemSetting.findFirst({
      where: { id, companyId: scope.companyId, namespace: PRINT_JOB_NAMESPACE },
    });
    if (!existing) throw new NotFoundException('Print job not found');
    await this.prisma.systemSetting.delete({ where: { id } });
    return { id, deleted: true };
  }
}
