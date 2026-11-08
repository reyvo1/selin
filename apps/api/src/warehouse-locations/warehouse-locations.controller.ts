import { BadRequestException, ForbiddenException, Controller, Get, Param, Post, Query, Body, Patch, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';

@ApiTags('warehouse-locations')
@ApiBearerAuth()
@Controller('warehouse-locations')
export class WarehouseLocationController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /warehouse-locations?warehouseId=...
   * List lokasi rak/bin di bawah gudang cabang ini.
   * Tenant guard: warehouseIds dibatasi company user (opsional branch user).
   */
  @Get()
  @Permissions('inventory.view')
  async list(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId?: string) {
    const { companyId, branchId } = this.requireTenantScope(user);
    const warehouseWhere: Prisma.WarehouseWhereInput = { branch: { companyId }, ...(branchId ? { branchId } : {}) };
    const warehouseRows = await this.prisma.warehouse.findMany({ where: warehouseWhere, select: { id: true, code: true, name: true } });
    const warehouseIds = warehouseRows.map((row) => row.id);
    const where: Prisma.WarehouseLocationWhereInput = { warehouseId: { in: warehouseIds } };
    if (warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, branch: { companyId }, ...(branchId ? { branchId } : {}) },
        select: { id: true },
      });
      if (!warehouse) {
        throw new ForbiddenException({ code: 'WAREHOUSE_TENANT_MISMATCH', message: 'Gudang tidak tersedia untuk cabang pengguna ini.' });
      }
      where.warehouseId = warehouseId;
    }
    const locations = await this.prisma.warehouseLocation.findMany({ where, orderBy: { code: 'asc' } });
    const warehouseMap = new Map(warehouseRows.map((row) => [row.id, row] as const));
    return locations.map((loc) => ({ ...loc, warehouse: warehouseMap.get(loc.warehouseId) ?? undefined }));
  }

  /**
   * POST /warehouse-locations
   * Buat location baru (rak/bin). Hanya untuk gudang milik cabang ini.
   */
  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('inventory.manage')
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: {
      warehouseId: string;
      code: string;
      name?: string;
      type?: string;
      capacity?: number;
      isActive?: boolean;
    },
  ) {
    const { companyId, branchId } = this.requireTenantScope(user);
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        branch: { companyId },
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true, code: true, name: true },
    });
    if (!warehouse) {
      throw new ForbiddenException({
        code: 'WAREHOUSE_TENANT_MISMATCH',
        message: 'Gudang tidak tersedia untuk cabang pengguna ini.',
      });
    }
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { warehouseId: warehouse.id, code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Lokasi kode "${dto.code}" sudah ada di gudang ${warehouse.code}.`);
    }
    const result = await this.prisma.warehouseLocation.create({
      data: {
        warehouseId: warehouse.id,
        code: dto.code,
        name: dto.name ?? dto.code,
        type: dto.type ?? 'BIN',
        capacity: dto.capacity != null ? new Prisma.Decimal(dto.capacity) : undefined,
        isActive: dto.isActive !== false,
      },
    });
    return { ...result, warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name } };
  }

  /**
   * POST /warehouse-locations/:id/deactivate
   * Nonaktifkan location (soft delete). Tidak menghapus data inventory yang ada.
   */
  @Post(':id/deactivate')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('inventory.manage')
  async deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { companyId, branchId } = this.requireTenantScope(user);
    // Dapatkan warehouseId milik location dulu
    const loc = await this.prisma.warehouseLocation.findUnique({ where: { id }, select: { warehouseId: true, code: true, isActive: true } });
    if (!loc) throw new ForbiddenException({ code: 'WAREHOUSE_LOCATION_NOT_FOUND', message: 'Lokasi tidak ditemukan.' });
    // Validasi warehouse milik tenant
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: loc.warehouseId, branch: { companyId }, ...(branchId ? { branchId } : {}) },
      select: { id: true },
    });
    if (!warehouse) {
      throw new ForbiddenException({ code: 'WAREHOUSE_LOCATION_TENANT_MISMATCH', message: 'Lokasi tidak tersedia untuk cabang pengguna ini.' });
    }
    if (!loc.isActive) throw new BadRequestException('Lokasi sudah nonaktif.');
    const stockCount = await this.prisma.inventoryLocationBalance.count({ where: { locationId: id, quantity: { gt: 0 } } });
    if (stockCount > 0) {
      throw new BadRequestException(`Lokasi ${loc.code} masih punya stok di ${stockCount} produk. Kosongkan stok terlebih dahulu.`);
    }
    const updated = await this.prisma.warehouseLocation.update({ where: { id }, data: { isActive: false } });
    return updated;
  }

  /**
   * PATCH /warehouse-locations/:id
   * Update nama, type, capacity location yang sudah ada.
   */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE')
  @Permissions('inventory.manage')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { name?: string; type?: string; capacity?: number },
  ) {
    const { companyId, branchId } = this.requireTenantScope(user);
    const loc = await this.prisma.warehouseLocation.findUnique({ where: { id }, select: { warehouseId: true } });
    if (!loc) throw new ForbiddenException({ code: 'WAREHOUSE_LOCATION_NOT_FOUND', message: 'Lokasi tidak ditemukan.' });
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: loc.warehouseId, branch: { companyId }, ...(branchId ? { branchId } : {}) },
      select: { id: true },
    });
    if (!warehouse) {
      throw new ForbiddenException({ code: 'WAREHOUSE_LOCATION_TENANT_MISMATCH', message: 'Lokasi tidak tersedia untuk cabang pengguna ini.' });
    }
    const updated = await this.prisma.warehouseLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.capacity !== undefined ? { capacity: new Prisma.Decimal(dto.capacity) } : {}),
      },
    });
    return updated;
  }

  private requireTenantScope(user: AuthUser) {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Pengguna belum memiliki company dan branch yang valid.',
      });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }
}
