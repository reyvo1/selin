import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';

@Injectable()
export class CustomerARSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingCoreService,
  ) {}

  private requireTenantScope(user: AuthUser) {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Pengguna belum memiliki company dan branch yang valid.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async aging(user: AuthUser, customerId?: string) {
    const scope = this.requireTenantScope(user);
    // AR aging dihitung dari OperationalFinanceTransaction jenis CUSTOMER_RECEIPT
    // yang masih memiliki outstanding (jurnal belum settled penuh).
    // Untuk P0, kita laporkan semua CUSTOMER_RECEIPT POSTED per customer, diurutkan
    // berdasarkan transactionDate.
    const where: Record<string, unknown> = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      type: 'CUSTOMER_RECEIPT',
      status: 'POSTED',
    };
    if (customerId) where.counterpartyId = customerId;

    const rows = await this.prisma.operationalFinanceTransaction.findMany({
      where,
      select: {
        id: true,
        number: true,
        transactionDate: true,
        counterpartyName: true,
        netAmount: true,
        grossAmount: true,
        referenceType: true,
        referenceId: true,
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    const now = Date.now();
    const buckets: Record<string, number> = {};
    let totalOutstanding = 0;

    for (const row of rows) {
      const daysPast = Math.floor((now - row.transactionDate.getTime()) / 86400000);
      let bucket: string;
      if (daysPast <= 0) bucket = 'CURRENT';
      else if (daysPast <= 30) bucket = '1-30';
      else if (daysPast <= 60) bucket = '31-60';
      else if (daysPast <= 90) bucket = '61-90';
      else bucket = '90+';
      const amount = Number(row.netAmount);
      buckets[bucket] = (buckets[bucket] ?? 0) + amount;
      totalOutstanding += amount;
    }

    const sorted = ['CURRENT', '1-30', '31-60', '61-90', '90+']
      .filter((b) => buckets[b] !== undefined)
      .map((b) => ({ bucket: b, amount: buckets[b] }));

    return {
      asOf: new Date(now).toISOString(),
      totalOutstanding: totalOutstanding.toFixed(2),
      buckets: sorted,
      transactions: rows,
    };
  }

  async settle(
    user: AuthUser,
    input: {
      invoiceId: string;
      amount: number;
      debitAccountCode?: string;
      note?: string;
      operationKey?: string;
    },
  ) {
    const scope = this.requireTenantScope(user);
    const { invoiceId, amount, note, operationKey } = input;
    const debitAccountCode = input.debitAccountCode ?? '1010';

    if (!operationKey) {
      throw new BadRequestException('operationKey wajib untuk pelunasan piutang (stabil untuk retry aman).');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Nominal pelunasan harus angka lebih dari nol.');
    }

    // Ambil invoice (OperationalFinanceTransaction) yang hendak di-settle
    const invoice = await this.prisma.operationalFinanceTransaction.findFirst({
      where: { id: invoiceId, companyId: scope.companyId, branchId: scope.branchId, status: 'POSTED' },
      select: {
        id: true,
        number: true,
        type: true,
        counterpartyId: true,
        counterpartyName: true,
        debitAccountCode: true,
        creditAccountCode: true,
        netAmount: true,
        referenceType: true,
        referenceId: true,
      },
    });
    if (!invoice) {
      throw new BadRequestException('Dokumen piutang tidak ditemukan atau belum POSTED.');
    }

    const opKey = `customer-ar-settle:${invoiceId}:${operationKey}`;

    // Pelunasan piutang: DEBIT akun kas/bank, KREDIT akun piutang
    // (akun kredit = creditAccountCode dari invoice, biasanya 1101 Piutang Usaha).
    const result = await this.prisma.$transaction(async (tx) => {
      const posted = await this.accounting.postOperationalEvent(tx, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        eventType: 'CUSTOMER_RECEIPT',
        sourceType: 'OperationalFinanceTransaction',
        sourceId: invoice.id,
        idempotencyKey: opKey,
        amounts: {
          gross: amount,
          settlement: amount,
          receivable: amount,
        },
        accountCodes: {
          settlement: debitAccountCode,
          receivable: invoice.creditAccountCode ?? '1101',
        },
        context: {
          note,
          settlementOfInvoiceNumber: invoice.number,
          counterpartyName: invoice.counterpartyName,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CUSTOMER_AR_SETTLED',
          entityType: 'OperationalFinanceTransaction',
          entityId: invoice.id,
          payload: { amount, debitAccountCode, operationKey: opKey, accountingEventId: posted.id },
        },
      });

      return posted;
    });

    return {
      success: true,
      invoiceId,
      amount: String(amount),
      accountingEventId: result.id,
      idempotencyKey: opKey,
      message: 'Pelunasan piutang berhasil diposting lewat accounting core.',
    };
  }
}
