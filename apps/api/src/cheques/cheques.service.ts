import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type ChequeScope = { companyId: string; branchId: string };

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['DEPOSITED'],
  DEPOSITED: ['CLEARED', 'BOUNCED'],
  ISSUED: ['CLEARED', 'BOUNCED'],
  CLEARED: [],
  BOUNCED: [],
};

type ChequeTransitionDto = {
  status?: string;
  toStatus?: string;
  newStatus?: string;
  targetStatus?: string;
  amount?: unknown;
  dueDate?: string | Date | null;
  reason?: string;
};

@Injectable()
export class ChequesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): ChequeScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException('Tenant context required');
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private parseLimit(value?: string): number {
    const parsed = value ? Number(value) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.min(Math.trunc(parsed), 100);
  }

  async list(user: AuthUser, status?: string, direction?: string, limitValue?: string, cursor?: string) {
    const scope = this.scope(user);
    const limit = this.parseLimit(limitValue);
    const rows = await this.prisma.cheque.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        ...(status ? { status: status.trim().toUpperCase() } : {}),
        ...(direction ? { direction: direction.trim().toUpperCase() } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      pageInfo: {
        limit,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      },
    };
  }

  async create(
    user: AuthUser,
    dto: {
      direction: string;
      number: string;
      partyType: string;
      partyId: string;
      amount: unknown;
      dueDate?: string | Date | null;
      status?: string;
    },
  ) {
    const scope = this.scope(user);
    const direction = dto.direction?.trim().toUpperCase();
    const number = dto.number?.trim();
    const partyType = dto.partyType?.trim();
    const partyId = dto.partyId?.trim();
    if (!direction) throw new BadRequestException('direction wajib diisi');
    if (!number) throw new BadRequestException('number wajib diisi');
    if (!partyType) throw new BadRequestException('partyType wajib diisi');
    if (!partyId) throw new BadRequestException('partyId wajib diisi');
    if (dto.amount === undefined || dto.amount === null || dto.amount === '') {
      throw new BadRequestException('amount wajib diisi');
    }

    const dueDate =
      dto.dueDate === undefined || dto.dueDate === null || dto.dueDate === ''
        ? null
        : new Date(dto.dueDate as string | Date);

    return this.prisma.cheque.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        direction,
        number,
        partyType,
        partyId,
        amount: dto.amount as never,
        status: dto.status
          ? dto.status.trim().toUpperCase()
          : ['AP', 'OUT'].includes(direction)
            ? 'ISSUED'
            : 'RECEIVED',
        dueDate,
      },
    });
  }

  async transitionStatus(
    user: AuthUser,
    id: string,
    dto: ChequeTransitionDto,
  ) {
    const scope = this.scope(user);
    const existing = await this.prisma.cheque.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!existing) throw new NotFoundException('Cheque not found');

    const next = (dto.status ?? dto.toStatus ?? dto.newStatus ?? dto.targetStatus ?? '').trim().toUpperCase();
    if (!next) throw new BadRequestException('status wajib diisi');

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Transisi status tidak diizinkan: ${existing.status} -> ${next}`);
    }

    // Validate amount when provided.
    const hasAmount = dto.amount !== undefined && dto.amount !== null && dto.amount !== '';
    let amountValue: Prisma.Decimal | undefined;
    if (hasAmount) {
      let amountDec: Prisma.Decimal;
      try {
        amountDec = new Prisma.Decimal(dto.amount as never);
      } catch {
        throw new BadRequestException('amount tidak valid');
      }
      if (!amountDec.isFinite() || amountDec.lessThanOrEqualTo(0) || amountDec.decimalPlaces() > 2) {
        throw new BadRequestException('amount tidak valid');
      }
      amountValue = amountDec;
    }

    // Validate dueDate when provided.
    let dueDateValue: Date | null | undefined;
    if (dto.dueDate !== undefined) {
      if (dto.dueDate === null || dto.dueDate === '') {
        dueDateValue = null;
      } else {
        const parsed = new Date(dto.dueDate as string | Date);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('dueDate tidak valid');
        }
        dueDateValue = parsed;
      }
    }

    // Validate reason when provided.
    let reason: string | undefined;
    if (dto.reason !== undefined && dto.reason !== null) {
      const trimmed = String(dto.reason).trim();
      if (!trimmed) {
        throw new BadRequestException('reason wajib diisi');
      }
      reason = trimmed;
    }

    const data: Record<string, unknown> = { status: next };
    if (hasAmount && amountValue !== undefined) data.amount = amountValue;
    if (dueDateValue !== undefined) data.dueDate = dueDateValue;

    const result = await this.prisma.cheque.updateMany({
      where: { id, companyId: scope.companyId, branchId: scope.branchId, status: existing.status },
      data: data as never,
    });
    if (result.count === 0) {
      throw new ConflictException('Status cheque telah berubah, ulangi transisi.');
    }

    const updated = await this.prisma.cheque.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Cheque not found');

    await this.prisma.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'TRANSITION_CHEQUE_STATUS',
        entityType: 'Cheque',
        entityId: id,
        payload: {
          number: existing.number,
          previousStatus: existing.status,
          newStatus: next,
          amount: hasAmount ? (amountValue?.toString() ?? null) : null,
          dueDate: dueDateValue !== undefined ? (dueDateValue ? dueDateValue.toISOString() : null) : null,
          reason: reason ?? null,
          branchId: scope.branchId,
        } as never,
      },
    });

    return updated;
  }

  async transition(
    user: AuthUser,
    id: string,
    dto: ChequeTransitionDto,
  ) {
    return this.transitionStatus(user, id, dto);
  }

  // Backward/alternative method names.
  async transitionChequeStatus(user: AuthUser, id: string, dto: ChequeTransitionDto) {
    return this.transitionStatus(user, id, dto);
  }

  async changeStatus(user: AuthUser, id: string, dto: ChequeTransitionDto) {
    return this.transitionStatus(user, id, dto);
  }

  async updateStatus(user: AuthUser, id: string, dto: ChequeTransitionDto) {
    return this.transitionStatus(user, id, dto);
  }
}
export { ChequesService as ChequeService };
