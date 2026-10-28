import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class SupplierPricesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Tenant context required' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private toDecimal(value: unknown, field = 'price'): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(String(value ?? ''));
      if (!decimal.isFinite()) throw new Error('not finite');
      return decimal.toDecimalPlaces(2);
    } catch {
      throw new BadRequestException(`${field} tidak valid.`);
    }
  }

  private parseDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Format tanggal harga tidak valid.');
    return date;
  }

  async list(user: AuthUser, supplierId?: string, productId?: string) {
    const scope = this.scope(user);
    return this.prisma.supplierPrice.findMany({
      where: {
        companyId: scope.companyId,
        ...(supplierId ? { supplierId } : {}),
        ...(productId ? { productId } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(user: AuthUser, dto: any) {
    const scope = this.scope(user);
    const supplierId = String(dto?.supplierId ?? '').trim();
    const productId = String(dto?.productId ?? '').trim();
    if (!supplierId) throw new BadRequestException('supplierId wajib diisi.');
    if (!productId) throw new BadRequestException('productId wajib diisi.');

    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, companyId: scope.companyId }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier tidak ditemukan.');
    const product = await this.prisma.product.findFirst({ where: { id: productId, companyId: scope.companyId }, select: { id: true } });
    if (!product) throw new NotFoundException('Produk tidak ditemukan.');

    const price = this.toDecimal(dto?.price, 'price');
    if (price.lessThanOrEqualTo(0)) throw new BadRequestException('price harus lebih dari 0.');
    const minQtyRaw = dto?.minQty ?? 1;
    const minQty = this.toDecimal(minQtyRaw, 'minQty');
    const effectiveFrom = this.parseDate(dto?.effectiveFrom);
    const effectiveTo = this.parseDate(dto?.effectiveTo);
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierPrice.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          supplierId,
          productId,
          variantId: dto?.variantId ? String(dto.variantId).trim() : null,
          productUnitId: dto?.productUnitId ? String(dto.productUnitId).trim() : null,
          unitCode: dto?.unitCode ? String(dto.unitCode).trim().toUpperCase() : null,
          minQty,
          price,
          effectiveFrom,
          effectiveTo,
          isActive: dto?.isActive !== false,
          notes: dto?.notes ? String(dto.notes).trim() : null,
        },
      });
      await tx.supplierPriceHistory.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          supplierId,
          productId,
          field: 'price',
          oldValue: null,
          newValue: price,
          changedById: user.sub,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_SUPPLIER_PRICE',
          entityType: 'SupplierPrice',
          entityId: row.id,
          payload: { supplierId, productId, price: price.toString() },
        },
      });
      return row;
    });
  }

  async update(user: AuthUser, id: string, dto: any) {
    const scope = this.scope(user);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplierPrice.findFirst({ where: { id, companyId: scope.companyId } });
      if (!existing) throw new NotFoundException('Harga supplier tidak ditemukan.');

      const data: any = {};
      if (dto?.price !== undefined) {
        const price = this.toDecimal(dto.price, 'price');
        if (price.lessThanOrEqualTo(0)) throw new BadRequestException('price harus lebih dari 0.');
        data.price = price;
      }
      if (dto?.minQty !== undefined) data.minQty = this.toDecimal(dto.minQty, 'minQty');
      if (dto?.variantId !== undefined) data.variantId = dto.variantId ? String(dto.variantId).trim() : null;
      if (dto?.productUnitId !== undefined) data.productUnitId = dto.productUnitId ? String(dto.productUnitId).trim() : null;
      if (dto?.unitCode !== undefined) data.unitCode = dto.unitCode ? String(dto.unitCode).trim().toUpperCase() : null;
      if (dto?.effectiveFrom !== undefined) data.effectiveFrom = this.parseDate(dto.effectiveFrom);
      if (dto?.effectiveTo !== undefined) data.effectiveTo = this.parseDate(dto.effectiveTo);
      if (dto?.isActive !== undefined) data.isActive = Boolean(dto.isActive);
      if (dto?.notes !== undefined) data.notes = dto.notes ? String(dto.notes).trim() : null;

      const effectiveFrom = data.effectiveFrom !== undefined ? data.effectiveFrom : existing.effectiveFrom;
      const effectiveTo = data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;
      if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');

      const row = await tx.supplierPrice.update({ where: { id }, data });

      if (dto?.price !== undefined) {
        const newPrice = this.toDecimal(dto.price, 'price');
        if (!new Prisma.Decimal(existing.price).equals(newPrice)) {
          await tx.supplierPriceHistory.create({
            data: {
              companyId: scope.companyId,
              branchId: scope.branchId,
              supplierId: existing.supplierId,
              productId: existing.productId,
              field: 'price',
              oldValue: new Prisma.Decimal(existing.price),
              newValue: newPrice,
              changedById: user.sub,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'UPDATE_SUPPLIER_PRICE',
          entityType: 'SupplierPrice',
          entityId: id,
          payload: { price: row.price.toString() },
        },
      });
      return row;
    });
  }

  async history(user: AuthUser, supplierId?: string, productId?: string) {
    const scope = this.scope(user);
    return this.prisma.supplierPriceHistory.findMany({
      where: {
        companyId: scope.companyId,
        ...(supplierId ? { supplierId } : {}),
        ...(productId ? { productId } : {}),
      },
      orderBy: [{ changedAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }
}
