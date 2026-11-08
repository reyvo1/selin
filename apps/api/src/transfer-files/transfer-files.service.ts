import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      take: 200,
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

  /**
   * F10: Import transaksi cabang dari payload JSON.
   * Payload format: { branchId: string; transactions: Array<{ type: string; refId: string; amount: number; timestamp: string }> }
   * Idempoten: jika TransferFile dengan checksum sama sudah diproses, kembalikan hasil sebelumnya.
   */
  async import(
    user: AuthUser,
    input: {
      direction: 'INBOUND' | 'OUTBOUND';
      fileName: string;
      payload: {
        branchId: string;
        transactions: Array<{ type: string; refId: string; amount: number; timestamp: string }>;
      };
    },
  ) {
    const scope = this.scope(user);
    const { direction, fileName, payload } = input;
    if (!payload?.branchId || !Array.isArray(payload.transactions)) {
      throw new BadRequestException('payload.branchId dan payload.transactions wajib diisi.');
    }
    // Branch target harus milik tenant yang sama
    const targetBranch = await this.prisma.branch.findFirst({
      where: { id: payload.branchId, companyId: scope.companyId },
      select: { id: true, name: true },
    });
    if (!targetBranch) {
      throw new BadRequestException(`Branch ${payload.branchId} tidak tersedia di tenant ini.`);
    }

    // Checksum untuk idempotensi (hash sederhana dari konten payload)
    const checksum = this.checksum(payload);
    const existing = await this.prisma.transferFile.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, fileName, checksum },
    });
    if (existing?.status === 'PROCESSED') {
      return {
        duplicate: true,
        fileId: existing.id,
        rowIngested: existing.rowIngested,
        rowRejected: existing.rowRejected,
        fileName,
        status: existing.status,
      };
    }

    const transferFile = await this.prisma.transferFile.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        direction,
        fileName,
        status: 'PROCESSING',
        payload: { branchId: payload.branchId, transactionCount: payload.transactions.length } as Prisma.InputJsonValue,
        checksum,
      },
    });

    let rowIngested = 0;
    let rowRejected = 0;
    for (const tx of payload.transactions) {
      if (!tx.type || !tx.refId || typeof tx.amount !== 'number') {
        rowRejected++;
        continue;
      }
      rowIngested++;
      // Catat audit: transaksi cabang diimport (tanpa mutasi stok/jurnal — itu domain masing-masing modul)
      await this.prisma.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'BRANCH_TRANSFER_TRANSACTION_IMPORTED',
          entityType: 'TransferFile',
          entityId: transferFile.id,
          payload: {
            direction,
            targetBranchId: targetBranch.id,
            transactionType: tx.type,
            refId: tx.refId,
            amount: tx.amount,
            fileName,
          },
        },
      });
    }

    const updated = await this.prisma.transferFile.update({
      where: { id: transferFile.id },
      data: {
        status: 'PROCESSED',
        rowIngested,
        rowRejected,
        processedBy: user.sub,
        processedAt: new Date(),
      },
    });

    return {
      duplicate: false,
      fileId: updated.id,
      rowIngested,
      rowRejected,
      fileName,
      status: updated.status,
    };
  }

  /**
   * F09: Export transaksi cabang ke payload JSON (untuk dikirim ke branch lain atau server pusat).
   * Read-only: tidak memodifikasi data.
   */
  async export(user: AuthUser, input: { direction: 'INBOUND' | 'OUTBOUND'; limit?: number }) {
    const scope = this.scope(user);
    const limit = Math.min(Number(input.limit ?? 500), 5000);
    const transactions = await this.prisma.auditLog.findMany({
      where: {
        companyId: scope.companyId,
        action: { in: ['BRANCH_TRANSFER_TRANSACTION_IMPORTED', 'SALE_CREATED', 'ORDER_CREATED', 'PURCHASE_RECEIVED'] },
      },
      select: {
        action: true,
        entityId: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const rows = transactions.map((row) => ({
      type: row.action,
      refId: row.entityId,
      amount: (row.payload as Record<string, unknown>)?.amount ?? 0,
      timestamp: row.createdAt.toISOString(),
    }));

    const exportPayload = { branchId: scope.branchId, exportType: input.direction, rows, exportedAt: new Date().toISOString() };
    const exportFile = await this.prisma.transferFile.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        direction: input.direction,
        fileName: `export-${input.direction.toLowerCase()}-${Date.now()}.json`,
        status: 'PENDING',
        payload: exportPayload as Prisma.InputJsonValue,
      },
    });

    return { fileId: exportFile.id, fileName: exportFile.fileName, rowIngested: rows.length, exportPayload };
  }

  private checksum(payload: unknown): string {
    // Simple deterministic hash for idempotency (not cryptographic, just stable content identity).
    const str = JSON.stringify(payload);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return `djb2:${(hash >>> 0).toString(16)}:${str.length}`;
  }
}
