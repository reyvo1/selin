import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions/report')
export class CommissionReportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('salesperson')
  @Permissions('commission.view')
  async getSalespersonCommission(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('salespersonId') salespersonId?: string,
  ) {
    const scope = this.requireScope(user);
    const dateFilter: Prisma.Sql = this.buildDateFilter(from, to);
    const spFilter = salespersonId ? Prisma.sql`AND so.salespersonId = ${salespersonId}` : Prisma.sql``;

    const results = await this.prisma.$queryRawUnsafe(`
      SELECT
        e.id as salespersonId,
        e.fullName as salespersonName,
        COUNT(DISTINCT so.id) as orderCount,
        SUM(so.total) as totalSales,
        SUM(CASE WHEN so.status IN ('COMPLETED', 'PAID') THEN so.total ELSE 0 END) as settledSales,
        cr.rate as commissionRate,
        SUM(CASE WHEN so.status IN ('COMPLETED', 'PAID') THEN so.total * cr.rate / 100 ELSE 0 END) as commissionAmount
      FROM sales_order so
      JOIN employee e ON so.salespersonId = e.id
      LEFT JOIN commission_rule cr ON cr.companyId = so.companyId AND cr.isActive = true
      WHERE so.companyId = ${scope.companyId}
        AND so.branchId = ${scope.branchId}
        ${dateFilter}
        ${spFilter}
      GROUP BY e.id, e.fullName, cr.rate
      ORDER BY totalSales DESC
    `);

    return results;
  }

  @Get('rule')
  @Permissions('commission.view')
  async getCommissionRules(@CurrentUser() user: AuthUser) {
    const scope = this.requireScope(user);
    return this.prisma.commissionRule.findMany({
      where: { companyId: scope.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private requireScope(user: AuthUser) {
    if (!user.companyId || !user.branchId) throw new Error('TENANT_CONTEXT_REQUIRED');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private buildDateFilter(from?: string, to?: string): Prisma.Sql {
    if (from && to) return Prisma.sql`AND so.createdAt BETWEEN ${from} AND ${to}`;
    if (from) return Prisma.sql`AND so.createdAt >= ${from}`;
    if (to) return Prisma.sql`AND so.createdAt <= ${to}`;
    return Prisma.sql``;
  }
}
