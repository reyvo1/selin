import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { MigrationDryRunDto, MigrationDryRunError, MigrationDryRunResult } from './dto/migration-dry-run.dto';
import { createHash } from 'node:crypto';

const REQUIRED: Record<string, string[]> = {
  products: ['sku', 'name', 'unit'],
  customers: ['name'],
  suppliers: ['name'],
  categories: ['name', 'slug'],
};

const KEYS: Record<string, string> = {
  products: 'sku',
  customers: 'name',
  suppliers: 'name',
  categories: 'slug',
};

type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class MigrationService {
  constructor(private readonly prisma: PrismaService) {}

  dryRun(dto: MigrationDryRunDto): MigrationDryRunResult {
    return this.validate(dto);
  }

  async cutoverCheck(user: AuthUser, dto: MigrationDryRunDto) {
    const result = this.validate(dto);
    const previewResult = await this.preview(user, dto);
    const conflicts = previewResult.conflicts ?? [];
    const reasons: string[] = [];
    if (result.invalid > 0) reasons.push(`${result.invalid} baris tidak valid.`);
    if (conflicts.length > 0) reasons.push(`${conflicts.length} konflik dengan database.`);
    if (dto.rows.length === 0) reasons.push('Tidak ada baris untuk dicutover.');
    return { ready: reasons.length === 0, reasons, valid: result.valid, total: result.total, conflicts };
  }

  async preview(user: AuthUser, dto: MigrationDryRunDto) {
    if (!user.companyId) throw new NotFoundException('Tenant context required');
    const result = this.validate(dto);
    const conflicts: MigrationDryRunError[] = [];
    if (dto.entityType === 'products') {
      const skus = dto.rows.map((r) => String(r?.sku ?? '').trim()).filter(Boolean);
      if (skus.length) {
        const existing = await this.prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } });
        const set = new Set(existing.map((p) => p.sku));
        dto.rows.forEach((r, index) => {
          const sku = String(r?.sku ?? '').trim();
          if (sku && set.has(sku)) conflicts.push({ index, field: 'sku', message: `SKU sudah ada di database: ${sku}.` });
        });
      }
    }
    if (dto.entityType === 'categories') {
      const slugs = dto.rows.map((r) => String(r?.slug ?? '').trim()).filter(Boolean);
      if (slugs.length) {
        const existing = await this.prisma.category.findMany({ where: { companyId: user.companyId, slug: { in: slugs } }, select: { slug: true } });
        const set = new Set(existing.map((c) => c.slug));
        dto.rows.forEach((r, index) => {
          const slug = String(r?.slug ?? '').trim();
          if (slug && set.has(slug)) conflicts.push({ index, field: 'slug', message: `Slug kategori sudah ada: ${slug}.` });
        });
      }
    }
    return { ...result, conflicts };
  }

  async cutover(user: AuthUser, dto: MigrationDryRunDto) {
    const scope = this.requireTenantScope(user);
    const result = this.validate(dto);
    const previewResult = await this.preview(user, dto);
    const conflicts = previewResult.conflicts ?? [];
    const reasons: string[] = [];
    if (result.invalid > 0) reasons.push(`${result.invalid} baris tidak valid.`);
    if (conflicts.length > 0) reasons.push(`${conflicts.length} konflik dengan database.`);
    if (dto.rows.length === 0) reasons.push('Tidak ada baris untuk dicutover.');
    if (reasons.length > 0) {
      return { cutover: false, ready: false, reasons, valid: result.valid, total: result.total, conflicts, created: 0, updated: 0, skipped: 0, checkpointId: null };
    }

    const checkpointId = `MIG-${dto.entityType}-${Date.now()}-${createHash('sha256').update(JSON.stringify(dto.rows)).digest('hex').slice(0, 12)}`;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      if (dto.entityType === 'products') {
        for (const row of dto.rows) {
          const sku = String(row?.sku ?? '').trim();
          const name = String(row?.name ?? sku).trim();
          const unit = String(row?.unit ?? 'pcs').trim();
          const cost = Number(row?.costPrice ?? 0);
          const sale = Number(row?.salePrice ?? 0);
          const existing = await tx.product.findFirst({ where: { sku } });
          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: { name, costPrice: new Prisma.Decimal(cost), salePrice: new Prisma.Decimal(sale) },
            });
            updated += 1;
          } else {
            await tx.product.create({
              data: { companyId: scope.companyId, sku, name, unit, costPrice: new Prisma.Decimal(cost), salePrice: new Prisma.Decimal(sale) },
            });
            created += 1;
          }
        }
      } else if (dto.entityType === 'customers') {
        for (const row of dto.rows) {
          const name = String(row?.name ?? '').trim();
          const existing = await tx.customer.findFirst({ where: { companyId: scope.companyId, name } });
          const data = {
            phone: row?.phone == null ? null : String(row.phone).trim(),
            email: row?.email == null ? null : String(row.email).trim(),
            address: row?.address == null ? null : String(row.address).trim(),
          };
          if (existing) {
            await tx.customer.update({ where: { id: existing.id }, data });
            updated += 1;
          } else {
            await tx.customer.create({ data: { companyId: scope.companyId, name, ...data } });
            created += 1;
          }
        }
      } else if (dto.entityType === 'suppliers') {
        for (const row of dto.rows) {
          const name = String(row?.name ?? '').trim();
          const code = String(row?.code ?? name).trim();
          const existing = await tx.supplier.findFirst({ where: { code } });
          const data = {
            name,
            phone: row?.phone == null ? null : String(row.phone).trim(),
            email: row?.email == null ? null : String(row.email).trim(),
            address: row?.address == null ? null : String(row.address).trim(),
          };
          if (existing) {
            await tx.supplier.update({ where: { id: existing.id }, data });
            updated += 1;
          } else {
            await tx.supplier.create({ data: { companyId: scope.companyId, code, ...data } });
            created += 1;
          }
        }
      } else if (dto.entityType === 'categories') {
        for (const row of dto.rows) {
          const name = String(row?.name ?? '').trim();
          const slug = String(row?.slug ?? '').trim();
          const existing = await tx.category.findFirst({ where: { companyId: scope.companyId, slug } });
          const data = {
            name,
            sortOrder: row?.sortOrder == null ? 0 : Number(row.sortOrder),
            isActive: row?.isActive == null ? true : Boolean(row.isActive),
          };
          if (existing) {
            await tx.category.update({ where: { id: existing.id }, data });
            updated += 1;
          } else {
            await tx.category.create({ data: { companyId: scope.companyId, slug, ...data } });
            created += 1;
          }
        }
      } else {
        skipped += dto.rows.length;
      }

      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'MIGRATION_CUTOVER',
          entityType: dto.entityType,
          entityId: checkpointId,
          payload: { branchId: scope.branchId, total: dto.rows.length, created, updated, skipped, checkpointId },
        },
      });
    });

    return { cutover: true, ready: true, reasons: [], valid: result.valid, total: result.total, conflicts: [], created, updated, skipped, checkpointId };
  }

  async rollbackCheck(user: AuthUser, dto: MigrationDryRunDto) {
    const scope = this.requireTenantScope(user);
    const result = this.validate(dto);
    const reasons: string[] = [];
    if (dto.rows.length === 0) reasons.push('Tidak ada baris untuk dicek rollback.');
    if (result.invalid > 0) reasons.push(`${result.invalid} baris tidak valid.`);

    if (dto.entityType === 'products') {
      for (const row of dto.rows) {
        const sku = String(row?.sku ?? '').trim();
        if (!sku) continue;
        const product = await this.prisma.product.findFirst({ where: { sku }, select: { id: true } });
        if (!product) { reasons.push(`Produk tidak ditemukan: ${sku}.`); continue; }
        const [saleItems, movements] = await Promise.all([
          this.prisma.saleItem.count({ where: { productId: product.id } }),
          this.prisma.inventoryMovement.count({ where: { productId: product.id } }),
        ]);
        if (saleItems > 0) reasons.push(`Produk ${sku} sudah dipakai pada penjualan.`);
        if (movements > 0) reasons.push(`Produk ${sku} sudah memiliki movement stok.`);
      }
    } else if (dto.entityType === 'customers') {
      for (const row of dto.rows) {
        const name = String(row?.name ?? '').trim();
        if (!name) continue;
        const customer = await this.prisma.customer.findFirst({ where: { companyId: scope.companyId, name }, select: { id: true } });
        if (!customer) { reasons.push(`Pelanggan tidak ditemukan: ${name}.`); continue; }
        const [sales, orders] = await Promise.all([
          this.prisma.sale.count({ where: { customerId: customer.id } }),
          this.prisma.order.count({ where: { customerId: customer.id } }),
        ]);
        if (sales > 0 || orders > 0) reasons.push(`Pelanggan ${name} sudah memiliki transaksi.`);
      }
    } else if (dto.entityType === 'suppliers') {
      for (const row of dto.rows) {
        const code = String(row?.code ?? row?.name ?? '').trim();
        if (!code) continue;
        const supplier = await this.prisma.supplier.findFirst({ where: { code }, select: { id: true } });
        if (!supplier) { reasons.push(`Supplier tidak ditemukan: ${code}.`); continue; }
        const [pos, grs] = await Promise.all([
          this.prisma.purchaseOrder.count({ where: { supplierId: supplier.id } }),
          this.prisma.goodsReceipt.count({ where: { supplierId: supplier.id } }),
        ]);
        if (pos > 0 || grs > 0) reasons.push(`Supplier ${code} sudah memiliki dokumen pembelian.`);
      }
    } else if (dto.entityType === 'categories') {
      for (const row of dto.rows) {
        const slug = String(row?.slug ?? '').trim();
        if (!slug) continue;
        const category = await this.prisma.category.findFirst({ where: { companyId: scope.companyId, slug }, select: { id: true } });
        if (!category) { reasons.push(`Kategori tidak ditemukan: ${slug}.`); continue; }
        const productCount = await this.prisma.product.count({ where: { categoryId: category.id } });
        if (productCount > 0) reasons.push(`Kategori ${slug} masih dipakai produk.`);
      }
    }

    return { ready: reasons.length === 0, reasons, total: result.total, valid: result.valid, rollbackMode: 'compensating' };
  }

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new NotFoundException('Tenant context required');
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private validate(dto: MigrationDryRunDto): MigrationDryRunResult {
    const entityType = dto.entityType;
    const required = REQUIRED[entityType] ?? [];
    const keyField = KEYS[entityType];
    const errors: MigrationDryRunError[] = [];
    const seen = new Set<string>();
    const rows = Array.isArray(dto.rows) ? dto.rows : [];

    rows.forEach((row, index) => {
      for (const field of required) {
        const value = row?.[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          errors.push({ index, field, message: `${field} wajib diisi.` });
        }
      }
      if (keyField) {
        const raw = row?.[keyField];
        const key = raw === undefined || raw === null ? '' : String(raw).trim();
        if (key) {
          if (seen.has(key)) {
            errors.push({ index, field: keyField, message: `${keyField} duplikat dalam batch: ${key}.` });
          } else {
            seen.add(key);
          }
        }
      }
      if (entityType === 'products') {
        const cost = row?.costPrice;
        const sale = row?.salePrice;
        if (cost !== undefined && cost !== null && Number(cost) < 0) errors.push({ index, field: 'costPrice', message: 'costPrice tidak boleh negatif.' });
        if (sale !== undefined && sale !== null && Number(sale) < 0) errors.push({ index, field: 'salePrice', message: 'salePrice tidak boleh negatif.' });
      }
    });

    const invalidIndexes = new Set(errors.map((e) => e.index));
    return {
      entityType,
      dryRun: dto.dryRun !== false,
      total: rows.length,
      valid: rows.length - invalidIndexes.size,
      invalid: invalidIndexes.size,
      errors,
      warnings: rows.length === 0 ? ['Tidak ada baris untuk divalidasi.'] : [],
    };
  }
}
