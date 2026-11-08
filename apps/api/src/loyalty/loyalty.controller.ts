import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('programs')
  @Permissions('loyalty.view')
  async listPrograms(@CurrentUser() user: AuthUser) {
    const scope = this.requireScope(user);
    return this.prisma.loyaltyProgram.findMany({
      where: { companyId: scope.companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, earnRate: true, redemptionRate: true, minimumRedeem: true },
    });
  }

  @Get('accounts/:customerId')
  @Permissions('loyalty.view')
  async getAccount(@CurrentUser() user: AuthUser, @Param('customerId') customerId: string) {
    const scope = this.requireScope(user);
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { companyId: scope.companyId, isActive: true },
      select: { id: true, redemptionRate: true, minimumRedeem: true },
    });
    if (!program) return { points: 0, program: null };
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { programId_customerId: { programId: program.id, customerId } },
      select: { points: true, customerId: true },
    });
    return {
      program: { id: program.id, redemptionRate: program.redemptionRate, minimumRedeem: program.minimumRedeem },
      points: account?.points ?? 0,
      redeemableDiscount: account ? (Number(account.points) / Number(program.redemptionRate)).toFixed(2) : '0',
    };
  }

  @Post('redeem/preview')
  @Permissions('loyalty.manage')
  async previewRedemption(@CurrentUser() user: AuthUser, @Body() dto: { customerId: string; points: number }) {
    const scope = this.requireScope(user);
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { companyId: scope.companyId, isActive: true },
      select: { id: true, redemptionRate: true, minimumRedeem: true },
    });
    if (!program) throw new BadRequestException('Program loyalitas aktif tidak ditemukan.');
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { programId_customerId: { programId: program.id, customerId: dto.customerId } },
      select: { points: true },
    });
    const availablePoints = account?.points ?? 0;
    if (dto.points > availablePoints) throw new BadRequestException(`Poin tidak cukup. Tersedia: ${availablePoints}`);
    if (dto.points < program.minimumRedeem) throw new BadRequestException(`Penukaran minimal ${program.minimumRedeem} poin.`);
    const discount = Number(dto.points) / Number(program.redemptionRate);
    return { availablePoints, requestedPoints: dto.points, discount: discount.toFixed(2), programId: program.id };
  }

  private requireScope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new BadRequestException({ code: 'TENANT_CONTEXT_REQUIRED' });
    return { companyId: user.companyId, branchId: user.branchId };
  }
}
