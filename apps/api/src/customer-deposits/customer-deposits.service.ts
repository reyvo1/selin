import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class CustomerDepositsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Tenant context required' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private toDecimal(value: unknown, field = 'amount'): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(String(value ?? ''));
      if (!decimal.isFinite()) throw new Error('not finite');
      return decimal.toDecimalPlaces(2);
    } catch {
      throw new BadRequestException(`${field} tidak valid.`);
    }
  }

  private resolveCustomerId(input: unknown): string | undefined {
    if (typeof input === 'string') return input.trim() || undefined;
    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const value = record.customerId ?? record.customer_id ?? record.customer;
      if (typeof value === 'string') return value.trim() || undefined;
    }
    return undefined;
  }

  private resolveAmount(input: unknown, fallback?: unknown): unknown {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const record = input as Record<string, unknown>;
      if (record.amount !== undefined) return record.amount;
      if (record.value !== undefined) return record.value;
    }
    return fallback;
  }

  private resolveDepositId(input: unknown, fallback?: unknown): string | undefined {
    if (typeof input === 'string') return input.trim() || undefined;
    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const value = record.id ?? record.depositId ?? record.deposit_id ?? record.customerDepositId;
      if (typeof value === 'string') return value.trim() || undefined;
    }
    if (typeof fallback === 'string') return fallback.trim() || undefined;
    return undefined;
  }

  async list(user: AuthUser, customerIdOrQuery?: unknown) {
    const scope = this.scope(user);
    const customerId = this.resolveCustomerId(customerIdOrQuery);
    return this.prisma.customerDeposit.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthUser, customerIdOrDto: unknown, amountArg?: unknown) {
    const scope = this.scope(user);
    const customerId = this.resolveCustomerId(
      typeof customerIdOrDto === 'string' ? { customerId: customerIdOrDto } : customerIdOrDto,
    );
    if (!customerId) throw new BadRequestException('customerId wajib diisi.');

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId: scope.companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan.');

    const amount = this.toDecimal(this.resolveAmount(customerIdOrDto, amountArg), 'amount');
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('amount harus lebih dari 0.');

    return this.prisma.customerDeposit.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        customerId,
        amount,
        balance: amount,
        status: 'OPEN',
      },
    });
  }

  async apply(user: AuthUser, idOrDto: unknown, dtoArg?: unknown) {
    const scope = this.scope(user);

    let depositId = this.resolveDepositId(idOrDto, dtoArg);
    const payload = idOrDto && typeof idOrDto === 'object' ? idOrDto : (dtoArg && typeof dtoArg === 'object' ? dtoArg : {});
    const amountInput = this.resolveAmount(payload, typeof dtoArg === 'string' || typeof dtoArg === 'number' ? dtoArg : undefined);

    if (!depositId) {
      const customerId = this.resolveCustomerId(payload);
      if (customerId) {
        const deposit = await this.prisma.customerDeposit.findFirst({
          where: { companyId: scope.companyId, branchId: scope.branchId, customerId, status: 'OPEN' },
          orderBy: { createdAt: 'asc' },
        });
        if (!deposit) throw new NotFoundException('Deposit pelanggan tidak ditemukan.');
        depositId = deposit.id;
      }
    }
    if (!depositId) throw new BadRequestException('depositId wajib diisi.');

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.customerDeposit.findFirst({
        where: { id: depositId, companyId: scope.companyId, branchId: scope.branchId },
      });
      if (!deposit) throw new NotFoundException('Deposit pelanggan tidak ditemukan.');

      const currentBalance = new Prisma.Decimal(deposit.balance);
      const applyAmount = amountInput === undefined || amountInput === null || amountInput === ''
        ? currentBalance
        : this.toDecimal(amountInput, 'amount');

      if (applyAmount.lessThanOrEqualTo(0)) throw new BadRequestException('amount harus lebih dari 0.');
      if (applyAmount.greaterThan(currentBalance)) throw new BadRequestException('amount melebihi saldo deposit.');

      const newBalance = currentBalance.sub(applyAmount).toDecimalPlaces(2);
      return tx.customerDeposit.update({
        where: { id: deposit.id },
        data: {
          balance: newBalance,
          status: newBalance.isZero() ? 'APPLIED' : 'OPEN',
        },
      });
    });
  }
}