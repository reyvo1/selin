import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { normalizeTenderPolicy, tenderPolicyMetadata } from '../common/tender-policy';
import { beginIdempotent, completeIdempotent, hashPayload } from '../common/idempotency';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto, CreateCategoryDto, CreateCustomerDto, CreateProductBarcodeDto, CreateProductPriceDto, CreateProductUnitDto, CreateProductVariantDto,
  CreateReferenceDto, CreateWarehouseDto, CreateWarehouseLocationDto, MASTER_REFERENCE_TYPES,
  UpdateBranchDto, UpdateCategoryDto, UpdateCustomerDto, UpdateProductBarcodeDto, UpdateProductPriceDto, UpdateProductUnitDto, UpdateProductVariantDto,
  UpdateReferenceDto, UpdateWarehouseDto, UpdateWarehouseLocationDto,
} from './dto/master-data.dto';
import {
  buildImageStorageKey,
  buildPublicImageUrl,
  categoryImageStorageRoot,
  validateImageBytes,
  type UploadedImageFile,
} from '../products/product-image.util';

type DbClient = Prisma.TransactionClient | PrismaService;
type Scope = { companyId: string; branchId: string };
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): Scope {
    if (!user.companyId || !user.branchId) throw new ForbiddenException('Company/branch pengguna belum valid.');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async audit(client: DbClient, user: AuthUser, action: string, entityType: string, entityId: string, extra?: Record<string, unknown>) {
    const scope = this.scope(user);
    await client.auditLog.create({ data: { companyId: scope.companyId, userId: user.sub, action, entityType, entityId, payload: json({ branchId: scope.branchId, ...(extra ?? {}) }) } });
  }

  private async branch(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.branch.findFirst({ where: { id, companyId: scope.companyId } });
    if (!row) throw new ForbiddenException('Cabang tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private async warehouse(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.warehouse.findFirst({ where: { id, branch: { companyId: scope.companyId } } });
    if (!row) throw new ForbiddenException('Gudang tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private async product(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.product.findFirst({ where: { id, companyId: scope.companyId } });
    if (!row) throw new ForbiddenException('Produk tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private async variant(client: DbClient, user: AuthUser, productId: string, variantId?: string | null) {
    if (!variantId) return null;
    await this.product(client, user, productId);
    const row = await client.productVariant.findFirst({ where: { id: variantId, productId, product: { companyId: this.scope(user).companyId } } });
    if (!row) throw new BadRequestException('Variant tidak ditemukan pada produk/perusahaan ini.');
    return row;
  }


  private async productUnit(client: DbClient, user: AuthUser, productId: string, id?: string | null) {
    if (!id) return null;
    const row = await client.productUnit.findFirst({ where: { id, productId, product: { companyId: this.scope(user).companyId } } });
    if (!row) throw new BadRequestException('Unit produk tidak ditemukan pada produk/perusahaan ini.');
    return row;
  }

  private normalizedUnit(value?: string | null) { return value?.trim().toUpperCase() || ''; }

  private async requireUnitMaster(client: DbClient, companyId: string | null, value?: string | null) {
    if (!companyId) throw new BadRequestException('Produk belum memiliki company sehingga master UNIT tidak dapat divalidasi.');
    const unit = this.normalizedUnit(value);
    if (!unit) throw new BadRequestException('Unit wajib dipilih dari master UNIT aktif.');
    const row = await client.masterReference.findFirst({
      where: { companyId, branchId: null, type: 'UNIT', code: unit, isActive: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unit ${unit} belum terdaftar pada master UNIT perusahaan yang aktif.`);
    return unit;
  }

  private async assertUnitReferenceCanDeactivate(client: DbClient, companyId: string, code: string) {
    const [baseProduct, productUnit, barcode, price] = await Promise.all([
      client.product.findFirst({ where: { companyId, unit: code }, select: { id: true } }),
      client.productUnit.findFirst({ where: { unitCode: code, product: { companyId } }, select: { id: true } }),
      client.productBarcode.findFirst({ where: { unitCode: code, product: { companyId } }, select: { id: true } }),
      client.productPrice.findFirst({ where: { unitCode: code, product: { companyId } }, select: { id: true } }),
    ]);
    if (baseProduct || productUnit || barcode || price) {
      throw new BadRequestException(`Unit ${code} masih dipakai produk/konversi/barcode/harga dan tidak dapat dinonaktifkan.`);
    }
  }

  private normalizedFactor(value?: number | Prisma.Decimal | null) {
    const factor = Number(value ?? 1);
    if (!Number.isSafeInteger(factor) || factor < 1) throw new BadRequestException('quantityFactor wajib integer minimal 1 karena stok fisik disimpan dalam base unit integer.');
    return factor;
  }

  private async validateSellingUnit(client: DbClient, product: { id: string; unit: string; companyId: string | null }, unitCode?: string | null, quantityFactor?: number | Prisma.Decimal | null, primary = false) {
    const baseUnit = await this.requireUnitMaster(client, product.companyId, product.unit);
    const unit = unitCode == null || !this.normalizedUnit(unitCode)
      ? baseUnit
      : await this.requireUnitMaster(client, product.companyId, unitCode);
    const factor = this.normalizedFactor(quantityFactor);
    if (primary && (factor !== 1 || unit !== baseUnit)) throw new BadRequestException('Barcode utama wajib mewakili 1 base unit produk.');
    if (factor > 1 && unit === baseUnit) throw new BadRequestException('Barcode kemasan dengan quantityFactor > 1 wajib memakai unitCode berbeda dari base unit.');
    return { baseUnit, unitCode: unit, quantityFactor: factor };
  }


  private slug(value: string) {
    return value.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
  }

  categories(user: AuthUser, search?: string) {
    const scope = this.scope(user);
    return this.prisma.category.findMany({
      where: {
        companyId: scope.companyId,
        ...(search?.trim() ? { name: { contains: search.trim() } } : {}),
      },
      include: {
        parent: { select: { id: true, name: true, slug: true, isActive: true } },
        _count: { select: { children: true, products: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }

  private async assertCategoryParent(
    client: DbClient,
    companyId: string,
    parentId: string | undefined,
    categoryId?: string,
  ) {
    const normalizedParentId = parentId?.trim() || undefined;
    if (!normalizedParentId) return undefined;
    if (categoryId && normalizedParentId === categoryId) throw new BadRequestException('Kategori tidak boleh menjadi parent dirinya sendiri.');
    const parent = await client.category.findFirst({
      where: { id: normalizedParentId, companyId },
      select: { id: true, parentId: true, isActive: true },
    });
    if (!parent) throw new BadRequestException('Parent kategori tidak ditemukan pada perusahaan ini.');
    if (!parent.isActive) throw new BadRequestException('Parent kategori harus aktif.');

    if (categoryId) {
      let cursor: { id: string; parentId: string | null } | null = parent;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor.id === categoryId) throw new BadRequestException('Hierarchy kategori membentuk siklus.');
        if (!cursor.parentId || visited.has(cursor.parentId)) break;
        visited.add(cursor.id);
        cursor = await client.category.findFirst({
          where: { id: cursor.parentId, companyId },
          select: { id: true, parentId: true },
        });
      }
    }
    return normalizedParentId;
  }

  private async assertCategoryNameAvailable(
    client: DbClient,
    companyId: string,
    name: string,
    parentId: string | undefined,
    excludeId?: string,
  ) {
    const duplicate = await client.category.findFirst({
      where: {
        companyId,
        parentId: parentId ?? null,
        name: name.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Nama kategori sudah digunakan pada level hierarchy yang sama.');
  }

  async createCategory(dto: CreateCategoryDto, user: AuthUser) {
    const scope = this.scope(user);
    const name = dto.name.trim();
    const slug = this.slug(dto.slug || dto.name);
    if (!name) throw new BadRequestException('Nama kategori wajib diisi.');
    if (!slug) throw new BadRequestException('Slug kategori tidak valid.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const parentId = await this.assertCategoryParent(tx, scope.companyId, dto.parentId);
        await this.assertCategoryNameAvailable(tx, scope.companyId, name, parentId);
        const row = await tx.category.create({
          data: {
            companyId: scope.companyId,
            parentId,
            name,
            slug,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
            imageUrl: dto.imageUrl?.trim() || null,
          },
          include: {
            parent: { select: { id: true, name: true, slug: true, isActive: true } },
            _count: { select: { children: true, products: true } },
          },
        });
        await this.audit(tx, user, 'CREATE_CATEGORY', 'Category', row.id, { slug, parentId: parentId ?? null });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Slug kategori sudah digunakan pada perusahaan ini.');
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, user: AuthUser) {
    const scope = this.scope(user);
    const existing = await this.prisma.category.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Kategori tidak ditemukan.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const parentId = dto.parentId !== undefined
          ? await this.assertCategoryParent(tx, scope.companyId, dto.parentId, id)
          : existing.parentId ?? undefined;
        const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
        if (!nextName) throw new BadRequestException('Nama kategori wajib diisi.');
        await this.assertCategoryNameAvailable(tx, scope.companyId, nextName, parentId, id);

        if (dto.isActive === false && existing.isActive) {
          const [activeChildren, activeProducts] = await Promise.all([
            tx.category.count({ where: { parentId: id, companyId: scope.companyId, isActive: true } }),
            tx.product.count({ where: { categoryId: id, companyId: scope.companyId, isActive: true } }),
          ]);
          if (activeChildren > 0) throw new BadRequestException('Nonaktifkan subkategori aktif terlebih dahulu.');
          if (activeProducts > 0) throw new BadRequestException('Kategori masih digunakan produk aktif.');
        }

        const data: Prisma.CategoryUpdateInput = {};
        if (dto.name !== undefined) data.name = nextName;
        if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl?.trim() || null;
        if (dto.slug !== undefined) {
          const nextSlug = this.slug(dto.slug);
          if (!nextSlug) throw new BadRequestException('Slug kategori tidak valid.');
          data.slug = nextSlug;
        }
        if (dto.parentId !== undefined) data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
        if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
        if (dto.isActive !== undefined) data.isActive = dto.isActive;

        const row = await tx.category.update({
          where: { id },
          data,
          include: {
            parent: { select: { id: true, name: true, slug: true, isActive: true } },
            _count: { select: { children: true, products: true } },
          },
        });
        await this.audit(tx, user, 'UPDATE_CATEGORY', 'Category', id, {
          parentId: row.parentId,
          isActive: row.isActive,
        });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Slug kategori sudah digunakan pada perusahaan ini.');
      throw error;
    }
  }

  // Upload foto kategori/subkategori dari perangkat operator. Pola yang sama dengan
  // upload foto produk: validasi isi -> tulis disk (nama acak, flag wx) -> transaksi DB
  // (idempotency scope 'category-image' + update imageUrl + audit). File yatim dibersihkan
  // bila transaksi gagal.
  async uploadCategoryImage(
    id: string,
    file: UploadedImageFile | undefined,
    idempotencyKey: string | undefined,
    user: AuthUser,
    hostInfo: { protocol: string; host: string },
  ) {
    const scope = this.scope(user);
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('File foto wajib diunggah.');
    const key = (idempotencyKey ?? '').trim();
    if (!key) throw new BadRequestException('Idempotency-Key wajib diisi.');
    let extension: string;
    try {
      extension = validateImageBytes(file.buffer, file.mimetype).extension;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'File gambar tidak valid.');
    }
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const payload = { categoryId: id, fileHash };
    const prior = await this.prisma.idempotencyReceipt.findUnique({
      where: { companyId_scope_key: { companyId: scope.companyId, scope: 'category-image', key } },
    });
    if (prior && prior.status === 'COMPLETED' && prior.requestHash === hashPayload(payload)) {
      return (prior.response as unknown as { id: string; imageUrl: string }) ?? null;
    }
    const storageKey = buildImageStorageKey(scope.companyId, id, extension);
    const root = categoryImageStorageRoot();
    const absolute = resolve(root, storageKey);
    if (absolute !== root && !absolute.startsWith(`${root}/`)) throw new BadRequestException('Lokasi foto tidak valid.');
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.buffer, { flag: 'wx' });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const receipt = await beginIdempotent(tx, { companyId: scope.companyId, scope: 'category-image', key, payload });
        if (receipt.replay) {
          if (receipt.status === 'COMPLETED') return receipt.response;
          throw new BadRequestException('Upload dengan Idempotency-Key ini masih diproses.');
        }
        const category = await tx.category.findFirst({ where: { id, companyId: scope.companyId } });
        if (!category) throw new NotFoundException('Kategori tidak ditemukan.');
        const imageUrl = buildPublicImageUrl(hostInfo.protocol, hostInfo.host, storageKey, '/media/category-images/');
        await tx.category.update({ where: { id: category.id }, data: { imageUrl } });
        await this.audit(tx, user, 'UPLOAD_CATEGORY_IMAGE', 'Category', category.id, {
          byteLength: file.buffer.length, storageKey,
        });
        const response = { id: category.id, imageUrl };
        await completeIdempotent(tx, { companyId: scope.companyId, scope: 'category-image', key, resourceType: 'Category', resourceId: category.id, response });
        return response;
      });
    } catch (error) {
      await unlink(absolute).catch(() => undefined);
      throw error;
    }
  }

  customers(user: AuthUser, search?: string) {    const scope = this.scope(user); const q = search?.trim();
    return this.prisma.customer.findMany({ where: { companyId: scope.companyId, ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}) }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500 });
  }

  async createCustomer(dto: CreateCustomerDto, user: AuthUser) {
    const scope = this.scope(user);
    try {
      return await this.prisma.$transaction(async (tx) => { const row = await tx.customer.create({ data: { companyId: scope.companyId, name: dto.name.trim(), phone: dto.phone?.trim(), email: dto.email?.trim().toLowerCase(), address: dto.address?.trim(), customerType: (dto.customerType || 'RETAIL').trim().toUpperCase(), taxIdNumber: dto.taxIdNumber?.trim(), customerRegionId: dto.customerRegionId?.trim() || null } }); await this.audit(tx, user, 'CREATE_CUSTOMER', 'Customer', row.id); return row; });
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email pelanggan sudah digunakan pada perusahaan ini.'); throw error; }
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, user: AuthUser) {
    const scope = this.scope(user); const existing = await this.prisma.customer.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Pelanggan tidak ditemukan.');
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim(); if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null; if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.customerType !== undefined) data.customerType = dto.customerType.trim().toUpperCase(); if (dto.taxIdNumber !== undefined) data.taxIdNumber = dto.taxIdNumber?.trim() || null; if (dto.customerRegionId !== undefined) data.customerRegionId = dto.customerRegionId?.trim() || null;
    return this.prisma.$transaction(async (tx) => { const row = await tx.customer.update({ where: { id }, data }); await this.audit(tx, user, 'UPDATE_CUSTOMER', 'Customer', id); return row; });
  }

  branches(user: AuthUser) { const scope = this.scope(user); return this.prisma.branch.findMany({ where: { companyId: scope.companyId }, orderBy: { name: 'asc' } }); }
  async createBranch(dto: CreateBranchDto, user: AuthUser) { const scope = this.scope(user); return this.prisma.$transaction(async (tx) => { const row = await tx.branch.create({ data: { companyId: scope.companyId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), address: dto.address?.trim() } }); await this.audit(tx, user, 'CREATE_BRANCH', 'Branch', row.id); return row; }); }
  async updateBranch(id: string, dto: UpdateBranchDto, user: AuthUser) {
    const scope = this.scope(user);
    await this.branch(this.prisma, user, id);
    if (dto.isActive === false) {
      if (id === scope.branchId) throw new BadRequestException('Cabang aktif saat ini tidak dapat dinonaktifkan. Pindahkan context ke cabang lain terlebih dahulu.');
      const activeUsers = await this.prisma.user.count({ where: { branchId: id, isActive: true } });
      if (activeUsers > 0) throw new BadRequestException('Cabang masih memiliki user aktif. Pindahkan/nonaktifkan user sebelum menonaktifkan cabang.');
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.branch.update({ where: { id }, data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit(tx, user, 'UPDATE_BRANCH', 'Branch', id, { isActive: row.isActive });
      return row;
    });
  }

  async warehouses(user: AuthUser, branchId?: string) { const scope = this.scope(user); if (branchId) await this.branch(this.prisma, user, branchId); return this.prisma.warehouse.findMany({ where: { branch: { companyId: scope.companyId }, ...(branchId ? { branchId } : {}) }, include: { branch: true }, orderBy: [{ branchId: 'asc' }, { name: 'asc' }] }); }
  async createWarehouse(dto: CreateWarehouseDto, user: AuthUser) { await this.branch(this.prisma, user, dto.branchId); return this.prisma.$transaction(async (tx) => { if (dto.isDefault) await tx.warehouse.updateMany({ where: { branchId: dto.branchId }, data: { isDefault: false } }); const row = await tx.warehouse.create({ data: { branchId: dto.branchId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), address: dto.address?.trim(), isDefault: dto.isDefault ?? false } }); await this.audit(tx, user, 'CREATE_WAREHOUSE', 'Warehouse', row.id, { targetBranchId: dto.branchId }); return row; }); }
  async updateWarehouse(id: string, dto: UpdateWarehouseDto, user: AuthUser) { const existing = await this.warehouse(this.prisma, user, id); const targetBranch = dto.branchId ?? existing.branchId; await this.branch(this.prisma, user, targetBranch); return this.prisma.$transaction(async (tx) => { if (dto.isDefault) await tx.warehouse.updateMany({ where: { branchId: targetBranch, id: { not: id } }, data: { isDefault: false } }); const row = await tx.warehouse.update({ where: { id }, data: { ...(dto.branchId !== undefined ? { branchId: targetBranch } : {}), ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}), ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_WAREHOUSE', 'Warehouse', id); return row; }); }

  async locations(user: AuthUser, warehouseId?: string) { const scope = this.scope(user); if (warehouseId) await this.warehouse(this.prisma, user, warehouseId); const warehouseIds = warehouseId ? [warehouseId] : (await this.prisma.warehouse.findMany({ where: { branch: { companyId: scope.companyId } }, select: { id: true } })).map((x) => x.id); return this.prisma.warehouseLocation.findMany({ where: { warehouseId: { in: warehouseIds } }, orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }] }); }
  async createLocation(dto: CreateWarehouseLocationDto, user: AuthUser) { await this.warehouse(this.prisma, user, dto.warehouseId); if (dto.parentId) { const parent = await this.prisma.warehouseLocation.findFirst({ where: { id: dto.parentId, warehouseId: dto.warehouseId } }); if (!parent) throw new BadRequestException('Parent lokasi tidak ditemukan pada gudang yang sama.'); } return this.prisma.$transaction(async (tx) => { const count = await tx.warehouseLocation.count({ where: { warehouseId: dto.warehouseId, isActive: true } }); const makeDefault = Boolean(dto.isDefault) || count === 0; if (makeDefault) await tx.warehouseLocation.updateMany({ where: { warehouseId: dto.warehouseId, isDefault: true }, data: { isDefault: false } }); const row = await tx.warehouseLocation.create({ data: { warehouseId: dto.warehouseId, parentId: dto.parentId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), type: (dto.type || 'BIN').trim().toUpperCase(), barcode: dto.barcode?.trim(), capacity: dto.capacity === undefined ? undefined : new Prisma.Decimal(dto.capacity), isDefault: makeDefault } }); await this.audit(tx, user, 'CREATE_WAREHOUSE_LOCATION', 'WarehouseLocation', row.id, { warehouseId: dto.warehouseId, isDefault: makeDefault }); return row; }); }
  async updateLocation(id: string, dto: UpdateWarehouseLocationDto, user: AuthUser) { const scope = this.scope(user); const row0 = await this.prisma.warehouseLocation.findUnique({ where: { id } }); if (!row0) throw new NotFoundException('Lokasi gudang tidak ditemukan.'); await this.warehouse(this.prisma, user, row0.warehouseId); const targetWarehouse = dto.warehouseId ?? row0.warehouseId; await this.warehouse(this.prisma, user, targetWarehouse); if (dto.parentId) { const parent = await this.prisma.warehouseLocation.findFirst({ where: { id: dto.parentId, warehouseId: targetWarehouse } }); if (!parent || parent.id === id) throw new BadRequestException('Parent lokasi tidak valid.'); } return this.prisma.$transaction(async (tx) => { if (dto.isDefault === true) await tx.warehouseLocation.updateMany({ where: { warehouseId: targetWarehouse, id: { not: id }, isDefault: true }, data: { isDefault: false } }); const row = await tx.warehouseLocation.update({ where: { id }, data: { ...(dto.warehouseId !== undefined ? { warehouseId: targetWarehouse } : {}), ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}), ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.type !== undefined ? { type: dto.type.trim().toUpperCase() } : {}), ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}), ...(dto.capacity !== undefined ? { capacity: new Prisma.Decimal(dto.capacity) } : {}), ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_WAREHOUSE_LOCATION', 'WarehouseLocation', id, { companyId: scope.companyId }); return row; }); }

  references(user: AuthUser, type?: string) {
    const scope = this.scope(user);
    if (type && !MASTER_REFERENCE_TYPES.includes(type.toUpperCase() as never)) throw new BadRequestException('Tipe master reference tidak didukung.');
    return this.prisma.masterReference.findMany({
      where: { companyId: scope.companyId, ...(type ? { type: type.toUpperCase() } : {}) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createReference(dto: CreateReferenceDto, user: AuthUser) {
    const scope = this.scope(user);
    const type = dto.type.toUpperCase() as typeof dto.type;
    const code = dto.code.trim().toUpperCase();
    if (!code || !dto.name.trim()) throw new BadRequestException('Kode dan nama master reference wajib diisi.');
    if (type === 'UNIT' && dto.branchId) throw new BadRequestException('Master UNIT berlaku untuk seluruh perusahaan dan tidak boleh dibatasi ke satu cabang.');
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    return this.prisma.$transaction(async (tx) => {
      let metadata = dto.metadata === undefined ? undefined : json(dto.metadata);
      if (type === 'PAYMENT_METHOD') {
        try { metadata = tenderPolicyMetadata(normalizeTenderPolicy(code, dto.metadata)); }
        catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Konfigurasi payment method tidak valid.'); }
      }
      const row = await tx.masterReference.create({
        data: { companyId: scope.companyId, branchId: type === 'UNIT' ? null : dto.branchId, type, code, name: dto.name.trim(), metadata },
      });
      await this.audit(tx, user, 'CREATE_MASTER_REFERENCE', 'MasterReference', row.id, { type: row.type, code: row.code });
      return row;
    });
  }

  async updateReference(id: string, dto: UpdateReferenceDto, user: AuthUser) {
    const scope = this.scope(user);
    const existing = await this.prisma.masterReference.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Master reference tidak ditemukan.');
    if (existing.type === 'UNIT' && dto.branchId) throw new BadRequestException('Master UNIT berlaku untuk seluruh perusahaan dan tidak boleh dibatasi ke satu cabang.');
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    return this.prisma.$transaction(async (tx) => {
      if (existing.type === 'UNIT' && dto.isActive === false && existing.isActive) {
        await this.assertUnitReferenceCanDeactivate(tx, scope.companyId, existing.code);
      }
      let metadata = dto.metadata === undefined ? undefined : json(dto.metadata);
      if (existing.type === 'PAYMENT_METHOD' && dto.metadata !== undefined) {
        try { metadata = tenderPolicyMetadata(normalizeTenderPolicy(existing.code, dto.metadata)); }
        catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Konfigurasi payment method tidak valid.'); }
      }
      const row = await tx.masterReference.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.branchId !== undefined ? { branchId: existing.type === 'UNIT' ? null : dto.branchId || null } : {}),
          ...(dto.metadata !== undefined ? { metadata } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      await this.audit(tx, user, 'UPDATE_MASTER_REFERENCE', 'MasterReference', id, { type: row.type, code: row.code, isActive: row.isActive });
      return row;
    });
  }


  async variants(productId: string, user: AuthUser) {
    await this.product(this.prisma, user, productId);
    return this.prisma.productVariant.findMany({
      where: { productId },
      include: { _count: { select: { barcodes: true, prices: true } } },
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async createVariant(productId: string, dto: CreateProductVariantDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    if (dto.salePrice !== undefined && product.retailCeilingPrice != null && dto.salePrice > Number(product.retailCeilingPrice)) throw new BadRequestException('Harga jual variant tidak boleh melebihi HET produk.');
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException('Kode dan nama variant wajib diisi.');
    const duplicate = await this.prisma.productVariant.findFirst({ where: { productId, code } });
    if (duplicate) throw new ConflictException('Kode variant sudah digunakan pada produk ini.');
    return this.prisma.$transaction(async (tx) => {
      const activeCount = await tx.productVariant.count({ where: { productId, isActive: true } });
      const makeDefault = dto.isDefault === true || activeCount === 0;
      if (makeDefault) await tx.productVariant.updateMany({ where: { productId, isDefault: true }, data: { isDefault: false } });
      const row = await tx.productVariant.create({ data: {
        productId,
        code,
        sku: dto.sku?.trim() || null,
        name,
        attributes: dto.attributes === undefined ? undefined : json(dto.attributes),
        costPrice: dto.costPrice === undefined ? undefined : new Prisma.Decimal(dto.costPrice),
        salePrice: dto.salePrice === undefined ? undefined : new Prisma.Decimal(dto.salePrice),
        isDefault: makeDefault,
        isActive: dto.isActive ?? true,
      } });
      await this.audit(tx, user, 'CREATE_PRODUCT_VARIANT', 'ProductVariant', row.id, { productId, code, isDefault: makeDefault });
      return row;
    });
  }

  async updateVariant(productId: string, id: string, dto: UpdateProductVariantDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    if (dto.salePrice !== undefined && product.retailCeilingPrice != null && dto.salePrice > Number(product.retailCeilingPrice)) throw new BadRequestException('Harga jual variant tidak boleh melebihi HET produk.');
    const existing = await this.prisma.productVariant.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Variant produk tidak ditemukan.');
    const code = dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code;
    if (dto.code !== undefined) {
      const duplicate = await this.prisma.productVariant.findFirst({ where: { productId, code, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new ConflictException('Kode variant sudah digunakan pada produk ini.');
    }
    return this.prisma.$transaction(async (tx) => {
      const makeDefault = dto.isDefault === true;
      if (makeDefault) await tx.productVariant.updateMany({ where: { productId, id: { not: id }, isDefault: true }, data: { isDefault: false } });
      const row = await tx.productVariant.update({ where: { id }, data: {
        ...(dto.code !== undefined ? { code } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku?.trim() || null } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.attributes !== undefined ? { attributes: json(dto.attributes) } : {}),
        ...(dto.costPrice !== undefined ? { costPrice: new Prisma.Decimal(dto.costPrice) } : {}),
        ...(dto.salePrice !== undefined ? { salePrice: new Prisma.Decimal(dto.salePrice) } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit(tx, user, 'UPDATE_PRODUCT_VARIANT', 'ProductVariant', id, { productId, code: row.code, isDefault: row.isDefault });
      return row;
    });
  }


  async units(productId: string, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const rows = await this.prisma.productUnit.findMany({
      where: { productId },
      include: { variant: true, _count: { select: { barcodes: true, prices: true } } },
      orderBy: [{ variantId: 'asc' }, { isActive: 'desc' }, { quantityFactor: 'asc' }, { unitCode: 'asc' }],
    });
    return { baseUnit: await this.requireUnitMaster(this.prisma, product.companyId, product.unit), rows };
  }

  async createUnit(productId: string, dto: CreateProductUnitDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const variant = await this.variant(this.prisma, user, productId, dto.variantId?.trim() || null);
    const validated = await this.validateSellingUnit(this.prisma, product, dto.unitCode, dto.quantityFactor, false);
    if (validated.unitCode === validated.baseUnit) throw new BadRequestException('Multi-UOM alternatif harus memakai unitCode berbeda dari base unit produk.');
    const scopeKey = variant?.id ?? 'BASE';
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefaultSale) await tx.productUnit.updateMany({ where: { productId, scopeKey, isDefaultSale: true }, data: { isDefaultSale: false } });
        if (dto.isDefaultPurchase) await tx.productUnit.updateMany({ where: { productId, scopeKey, isDefaultPurchase: true }, data: { isDefaultPurchase: false } });
        const row = await tx.productUnit.create({ data: {
          productId, variantId: variant?.id ?? null, scopeKey, unitCode: validated.unitCode, quantityFactor: validated.quantityFactor,
          isDefaultSale: dto.isDefaultSale ?? false, isDefaultPurchase: dto.isDefaultPurchase ?? false, isActive: dto.isActive ?? true,
        } });
        await this.audit(tx, user, 'CREATE_PRODUCT_UNIT', 'ProductUnit', row.id, { productId, variantId: row.variantId, unitCode: row.unitCode, quantityFactor: row.quantityFactor });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Unit produk sudah terdaftar untuk produk/variant ini.');
      throw error;
    }
  }

  async updateUnit(productId: string, id: string, dto: UpdateProductUnitDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const existing = await this.prisma.productUnit.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Unit produk tidak ditemukan.');
    const targetVariantId = dto.variantId !== undefined ? (dto.variantId?.trim() || null) : existing.variantId;
    const variant = await this.variant(this.prisma, user, productId, targetVariantId);
    const unitCode = dto.unitCode !== undefined ? dto.unitCode : existing.unitCode;
    const quantityFactor = dto.quantityFactor !== undefined ? dto.quantityFactor : existing.quantityFactor;
    const validated = await this.validateSellingUnit(this.prisma, product, unitCode, quantityFactor, false);
    if (validated.unitCode === validated.baseUnit) throw new BadRequestException('Multi-UOM alternatif harus memakai unitCode berbeda dari base unit produk.');
    const scopeKey = variant?.id ?? 'BASE';
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefaultSale === true) await tx.productUnit.updateMany({ where: { productId, scopeKey, id: { not: id }, isDefaultSale: true }, data: { isDefaultSale: false } });
        if (dto.isDefaultPurchase === true) await tx.productUnit.updateMany({ where: { productId, scopeKey, id: { not: id }, isDefaultPurchase: true }, data: { isDefaultPurchase: false } });
        if (dto.isActive === false) {
          const linked = await tx.productBarcode.findFirst({ where: { productUnitId: id }, select: { id: true } });
          const priced = await tx.productPrice.findFirst({ where: { productUnitId: id, isActive: true }, select: { id: true } });
          if (linked || priced) throw new BadRequestException('Unit masih dipakai barcode/harga aktif. Lepaskan dependensi sebelum menonaktifkan unit.');
        }
        const row = await tx.productUnit.update({ where: { id }, data: {
          ...(dto.variantId !== undefined ? { variantId: variant?.id ?? null, scopeKey } : {}),
          ...(dto.unitCode !== undefined ? { unitCode: validated.unitCode } : {}),
          ...(dto.quantityFactor !== undefined ? { quantityFactor: validated.quantityFactor } : {}),
          ...(dto.isDefaultSale !== undefined ? { isDefaultSale: dto.isDefaultSale } : {}),
          ...(dto.isDefaultPurchase !== undefined ? { isDefaultPurchase: dto.isDefaultPurchase } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        } });
        if (dto.unitCode !== undefined || dto.quantityFactor !== undefined || dto.variantId !== undefined) {
          await tx.productBarcode.updateMany({ where: { productUnitId: id }, data: { variantId: row.variantId, unitCode: row.unitCode, quantityFactor: new Prisma.Decimal(row.quantityFactor) } });
          await tx.productPrice.updateMany({ where: { productUnitId: id }, data: { variantId: row.variantId, unitCode: row.unitCode } });
        }
        await this.audit(tx, user, 'UPDATE_PRODUCT_UNIT', 'ProductUnit', id, { productId, variantId: row.variantId, unitCode: row.unitCode, quantityFactor: row.quantityFactor, isActive: row.isActive });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Unit produk sudah terdaftar untuk produk/variant ini.');
      throw error;
    }
  }

  async barcodes(productId: string, user: AuthUser) {
    await this.product(this.prisma, user, productId);
    return this.prisma.productBarcode.findMany({ where: { productId }, include: { variant: true, productUnit: true }, orderBy: [{ variantId: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }] });
  }

  async createBarcode(productId: string, dto: CreateProductBarcodeDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const requestedUnit = await this.productUnit(this.prisma, user, productId, dto.productUnitId?.trim() || null);
    const requestedVariantId = dto.variantId?.trim() || requestedUnit?.variantId || null;
    const variant = await this.variant(this.prisma, user, productId, requestedVariantId);
    if (requestedUnit && requestedUnit.variantId !== (variant?.id ?? null)) throw new BadRequestException('Unit produk tidak sesuai dengan variant barcode.');
    if (requestedUnit && !requestedUnit.isActive) throw new BadRequestException('Unit produk harus aktif.');
    const conversion = requestedUnit
      ? { baseUnit: await this.requireUnitMaster(this.prisma, product.companyId, product.unit), unitCode: requestedUnit.unitCode, quantityFactor: requestedUnit.quantityFactor }
      : await this.validateSellingUnit(this.prisma, product, dto.unitCode, dto.quantityFactor, dto.isPrimary ?? false);
    return this.prisma.$transaction(async (tx) => {
      const variantId = variant?.id ?? null;
      if (dto.isPrimary) await tx.productBarcode.updateMany({ where: { productId, variantId, isPrimary: true }, data: { isPrimary: false } });
      const row = await tx.productBarcode.create({ data: {
        productId,
        variantId,
        productUnitId: requestedUnit?.id ?? null,
        code: dto.code.trim(),
        unitCode: conversion.unitCode,
        quantityFactor: new Prisma.Decimal(conversion.quantityFactor),
        isPrimary: dto.isPrimary ?? false,
      } });
      if (!variantId && (row.isPrimary || !product.barcode)) await tx.product.update({ where: { id: productId }, data: { barcode: row.code } });
      await this.audit(tx, user, 'CREATE_PRODUCT_BARCODE', 'ProductBarcode', row.id, { productId, variantId, unitCode: conversion.unitCode, quantityFactor: conversion.quantityFactor });
      return row;
    });
  }

  async updateBarcode(productId: string, id: string, dto: UpdateProductBarcodeDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const existing = await this.prisma.productBarcode.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Barcode produk tidak ditemukan.');
    const targetUnit = dto.productUnitId !== undefined
      ? await this.productUnit(this.prisma, user, productId, dto.productUnitId?.trim() || null)
      : await this.productUnit(this.prisma, user, productId, existing.productUnitId);
    const targetVariantId = dto.variantId !== undefined ? (dto.variantId?.trim() || null) : (targetUnit?.variantId ?? existing.variantId);
    await this.variant(this.prisma, user, productId, targetVariantId);
    if (targetUnit && targetUnit.variantId !== targetVariantId) throw new BadRequestException('Unit produk tidak sesuai dengan variant barcode.');
    if (targetUnit && !targetUnit.isActive) throw new BadRequestException('Unit produk harus aktif.');
    const targetPrimary = dto.isPrimary ?? existing.isPrimary;
    const conversion = targetUnit
      ? { baseUnit: await this.requireUnitMaster(this.prisma, product.companyId, product.unit), unitCode: targetUnit.unitCode, quantityFactor: targetUnit.quantityFactor }
      : await this.validateSellingUnit(
          this.prisma, product,
          dto.unitCode !== undefined ? dto.unitCode : existing.unitCode,
          dto.quantityFactor !== undefined ? dto.quantityFactor : existing.quantityFactor,
          targetPrimary,
        );
    return this.prisma.$transaction(async (tx) => {
      if (targetPrimary) await tx.productBarcode.updateMany({ where: { productId, variantId: targetVariantId, id: { not: id }, isPrimary: true }, data: { isPrimary: false } });
      const row = await tx.productBarcode.update({ where: { id }, data: {
        ...(dto.variantId !== undefined || dto.productUnitId !== undefined ? { variantId: targetVariantId } : {}),
        ...(dto.productUnitId !== undefined ? { productUnitId: targetUnit?.id ?? null } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        unitCode: conversion.unitCode,
        quantityFactor: new Prisma.Decimal(conversion.quantityFactor),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      } });
      if (!targetVariantId && row.isPrimary) await tx.product.update({ where: { id: productId }, data: { barcode: row.code } });
      await this.audit(tx, user, 'UPDATE_PRODUCT_BARCODE', 'ProductBarcode', id, { productId, variantId: targetVariantId, unitCode: conversion.unitCode, quantityFactor: conversion.quantityFactor });
      return row;
    });
  }

  async prices(productId: string, user: AuthUser) {
    await this.product(this.prisma, user, productId);
    const scope = this.scope(user);
    return this.prisma.productPrice.findMany({
      where: { productId, OR: [{ branchId: null }, { branch: { companyId: scope.companyId } }] },
      include: { branch: true, variant: true, productUnit: true },
      orderBy: [{ variantId: 'asc' }, { isActive: 'desc' }, { segmentCode: 'asc' }, { minQty: 'asc' }],
    });
  }

  private parseDate(value?: string) { if (!value) return undefined; const date = new Date(value); if (Number.isNaN(date.getTime())) throw new BadRequestException('Format tanggal harga tidak valid.'); return date; }

  async createPrice(productId: string, dto: CreateProductPriceDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    await this.requireUnitMaster(this.prisma, product.companyId, product.unit);
    const requestedUnit = await this.productUnit(this.prisma, user, productId, dto.productUnitId?.trim() || null);
    const requestedVariantId = dto.variantId?.trim() || requestedUnit?.variantId || null;
    const variant = await this.variant(this.prisma, user, productId, requestedVariantId);
    if (requestedUnit && requestedUnit.variantId !== (variant?.id ?? null)) throw new BadRequestException('Unit produk tidak sesuai dengan variant harga.');
    if (requestedUnit && !requestedUnit.isActive) throw new BadRequestException('Unit produk harus aktif.');
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    const unitCode = requestedUnit?.unitCode ?? dto.unitCode?.trim().toUpperCase() ?? null;
    if (unitCode) await this.requireUnitMaster(this.prisma, product.companyId, unitCode);
    let quantityFactor = requestedUnit ? Number(requestedUnit.quantityFactor) : 1;
    if (!requestedUnit && unitCode && unitCode !== this.normalizedUnit(product.unit)) {
      const conversion = await this.prisma.productBarcode.findFirst({ where: { productId, variantId: variant?.id ?? null, unitCode, quantityFactor: { gt: new Prisma.Decimal(1) } }, select: { id: true, quantityFactor: true } });
      if (!conversion) throw new BadRequestException(`Harga unit ${unitCode} membutuhkan barcode/konversi aktif untuk ${variant ? 'variant ini' : 'produk dasar'}.`);
      quantityFactor = Number(conversion.quantityFactor);
    }
    if (product.retailCeilingPrice != null && dto.price > Number(product.retailCeilingPrice) * quantityFactor) throw new BadRequestException('Harga jual tidak boleh melebihi HET produk setelah faktor unit diterapkan.');
    const from = this.parseDate(dto.effectiveFrom), to = this.parseDate(dto.effectiveTo);
    if (from && to && from > to) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.create({ data: { productId, variantId: variant?.id ?? null, productUnitId: requestedUnit?.id ?? null, branchId: dto.branchId, segmentCode: (dto.segmentCode || 'RETAIL').trim().toUpperCase(), customerRegionId: dto.customerRegionId?.trim() || null, unitCode, minQty: new Prisma.Decimal(dto.minQty ?? 1), price: new Prisma.Decimal(dto.price), effectiveFrom: from, effectiveTo: to } });
      await this.audit(tx, user, 'CREATE_PRODUCT_PRICE', 'ProductPrice', row.id, { productId, variantId: variant?.id ?? null, targetBranchId: dto.branchId ?? null, unitCode });
      return row;
    });
  }

  async updatePrice(productId: string, id: string, dto: UpdateProductPriceDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    await this.requireUnitMaster(this.prisma, product.companyId, product.unit);
    const existing = await this.prisma.productPrice.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Harga produk tidak ditemukan.');
    const targetUnit = dto.productUnitId !== undefined
      ? await this.productUnit(this.prisma, user, productId, dto.productUnitId?.trim() || null)
      : await this.productUnit(this.prisma, user, productId, existing.productUnitId);
    const targetVariantId = dto.variantId !== undefined ? (dto.variantId?.trim() || null) : (targetUnit?.variantId ?? existing.variantId);
    await this.variant(this.prisma, user, productId, targetVariantId);
    if (targetUnit && targetUnit.variantId !== targetVariantId) throw new BadRequestException('Unit produk tidak sesuai dengan variant harga.');
    if (targetUnit && !targetUnit.isActive) throw new BadRequestException('Unit produk harus aktif.');
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    const unitCode = targetUnit?.unitCode ?? (dto.unitCode !== undefined ? (dto.unitCode?.trim().toUpperCase() || null) : existing.unitCode);
    if (unitCode) await this.requireUnitMaster(this.prisma, product.companyId, unitCode);
    let quantityFactor = targetUnit ? Number(targetUnit.quantityFactor) : 1;
    if (!targetUnit && unitCode && unitCode.toUpperCase() !== this.normalizedUnit(product.unit)) {
      const conversion = await this.prisma.productBarcode.findFirst({ where: { productId, variantId: targetVariantId, unitCode: unitCode.toUpperCase(), quantityFactor: { gt: new Prisma.Decimal(1) } }, select: { id: true, quantityFactor: true } });
      if (!conversion) throw new BadRequestException(`Harga unit ${unitCode} membutuhkan barcode/konversi aktif untuk ${targetVariantId ? 'variant ini' : 'produk dasar'}.`);
      quantityFactor = Number(conversion.quantityFactor);
    }
    const nextPrice = dto.price ?? Number(existing.price);
    if (product.retailCeilingPrice != null && nextPrice > Number(product.retailCeilingPrice) * quantityFactor) throw new BadRequestException('Harga jual tidak boleh melebihi HET produk setelah faktor unit diterapkan.');
    const from = dto.effectiveFrom !== undefined ? this.parseDate(dto.effectiveFrom) : existing.effectiveFrom ?? undefined;
    const to = dto.effectiveTo !== undefined ? this.parseDate(dto.effectiveTo) : existing.effectiveTo ?? undefined;
    if (from && to && from > to) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.update({ where: { id }, data: {
        ...(dto.variantId !== undefined || dto.productUnitId !== undefined ? { variantId: targetVariantId } : {}),
        ...(dto.productUnitId !== undefined ? { productUnitId: targetUnit?.id ?? null } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}),
        ...(dto.segmentCode !== undefined ? { segmentCode: dto.segmentCode.trim().toUpperCase() } : {}),
        ...(dto.customerRegionId !== undefined ? { customerRegionId: dto.customerRegionId?.trim() || null } : {}),
        ...(dto.unitCode !== undefined ? { unitCode } : {}),
        ...(dto.minQty !== undefined ? { minQty: new Prisma.Decimal(dto.minQty) } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: from ?? null } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo: to ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit(tx, user, 'UPDATE_PRODUCT_PRICE', 'ProductPrice', id, { productId, variantId: targetVariantId, unitCode });
      return row;
    });
  }

  private requireTenantScope(user: AuthUser): { companyId: string; branchId: string } {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Pengguna belum memiliki company dan branch yang valid.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private exportRowLimit = 10000;

  private csvEscape(value: unknown): string {
    const raw = value == null ? '' : String(value);
    return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  }

  private buildCsv(headers: string[], rows: unknown[][]): string {
    return [headers.join(','), ...rows.map((row) => row.map((value) => this.csvEscape(value)).join(','))].join('\n');
  }

  private renderXlsxBuffer(csv: string): Buffer {
    const rows = this.parseCsvRows(csv);
    const rowXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const ref = `${this.excelColumn(columnIndex)}${rowIndex + 1}`;
      const numeric = rowIndex > 0 && value.trim() !== '' && Number.isFinite(Number(value));
      return numeric ? `<c r="${ref}"><v>${Number(value)}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${this.xmlEscape(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const files = [
      { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
      { name: '_rels/.rels', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`) },
    ];
    return this.zipStored(files);
  }

  private xmlEscape(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  private excelColumn(index: number): string {
    let value = index + 1;
    let result = '';
    while (value > 0) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
    return result;
  }

  private parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < csv.length; i += 1) {
      const c = csv[i];
      if (quoted) {
        if (c === '"' && csv[i + 1] === '"') { cell += '"'; i += 1; continue; }
        if (c === '"') { quoted = false; continue; }
        cell += c;
        continue;
      }
      if (c === '"') { quoted = true; continue; }
      if (c === ',' || c === ';') { row.push(cell); cell = ''; continue; }
      if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; continue; }
      cell += c;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  }

  private zipStored(files: Array<{ name: string; data: Buffer }>): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8');
      const crc = this.crc32(file.data);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
      local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      locals.push(local, name, file.data);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
      central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(file.data.length, 20); central.writeUInt32LE(file.data.length, 24);
      central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
      centrals.push(central, name);
      offset += local.length + name.length + file.data.length;
    }
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
    return Buffer.concat([...locals, ...centrals, end]);
  }

  private crc32(buffer: Buffer): number {
    let table: Uint32Array | undefined;
    if (!table) {
      table = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async exportMasterData(user: AuthUser, entity?: string, format?: string) {
    const scope = this.requireTenantScope(user);
    const normalizedEntity = String(entity ?? 'products').trim().toLowerCase();
    const normalizedFormat = String(format ?? 'CSV').trim().toUpperCase();
    const rowLimit = this.exportRowLimit;
    let fileNameBase = normalizedEntity || 'export';
    let headers: string[] = [];
    let dataRows: unknown[][] = [];

    if (normalizedEntity === 'products' || normalizedEntity === 'product') {
      const rows = await this.prisma.product.findMany({ where: { companyId: scope.companyId }, include: { category: { select: { slug: true } } }, orderBy: [{ sku: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['sku','name','barcode','unit','costPrice','salePrice','retailCeilingPrice','minStock','brandCode','categorySlug','productType','trackBatch','trackExpiry','trackSerial','isActive'];
      dataRows = exported.map((row: any) => [row.sku,row.name,row.barcode,row.unit,row.costPrice,row.salePrice,row.retailCeilingPrice,row.minStock,row.brandCode,row.category?.slug,row.productType,row.trackBatch,row.trackExpiry,row.trackSerial,row.isActive]);
      fileNameBase = 'products';
      const csv = this.buildCsv(headers, dataRows);
      const rowCount = exported.length;
      const isTruncated = truncated;
      return this.finishExport(fileNameBase, csv, rowCount, rowLimit, isTruncated, normalizedFormat);
    }

    if (normalizedEntity === 'customers' || normalizedEntity === 'customer') {
      const rows = await this.prisma.customer.findMany({ where: { companyId: scope.companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','name','phone','email','address','customerType','taxIdNumber','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.name,row.phone,row.email,row.address,row.customerType,row.taxIdNumber,row.isActive]);
      fileNameBase = 'customers';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    if (normalizedEntity === 'categories' || normalizedEntity === 'category') {
      const rows = await this.prisma.category.findMany({ where: { companyId: scope.companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','name','slug','parentId','sortOrder','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.name,row.slug,row.parentId,row.sortOrder,row.isActive]);
      fileNameBase = 'categories';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    if (normalizedEntity === 'branches' || normalizedEntity === 'branch') {
      const rows = await this.prisma.branch.findMany({ where: { companyId: scope.companyId }, orderBy: [{ code: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','code','name','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.code,row.name,row.isActive]);
      fileNameBase = 'branches';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    if (normalizedEntity === 'warehouses' || normalizedEntity === 'warehouse') {
      const rows = await this.prisma.warehouse.findMany({ where: { branch: { companyId: scope.companyId } }, orderBy: [{ code: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','branchId','code','name','address','isDefault','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.branchId,row.code,row.name,row.address,row.isDefault,row.isActive]);
      fileNameBase = 'warehouses';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    if (normalizedEntity === 'suppliers' || normalizedEntity === 'supplier') {
      const rows = await this.prisma.supplier.findMany({ where: { companyId: scope.companyId }, orderBy: [{ code: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','code','name','phone','email','address','paymentTermDays','taxIdNumber','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.code,row.name,row.phone,row.email,row.address,row.paymentTermDays,row.taxIdNumber,row.isActive]);
      fileNameBase = 'suppliers';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    if (normalizedEntity === 'references' || normalizedEntity === 'reference') {
      const rows = await this.prisma.masterReference.findMany({ where: { OR: [{ branchId: null }, { branch: { companyId: scope.companyId } }] }, orderBy: [{ type: 'asc' }, { code: 'asc' }, { id: 'asc' }], take: rowLimit + 1 });
      const truncated = rows.length > rowLimit;
      const exported = truncated ? rows.slice(0, rowLimit) : rows;
      headers = ['id','type','code','name','branchId','isActive'];
      dataRows = exported.map((row: any) => [row.id,row.type,row.code,row.name,row.branchId,row.isActive]);
      fileNameBase = 'references';
      const csv = this.buildCsv(headers, dataRows);
      return this.finishExport(fileNameBase, csv, exported.length, rowLimit, truncated, normalizedFormat);
    }

    throw new BadRequestException(`Entity export tidak didukung: ${entity}.`);
  }

  private finishExport(fileNameBase: string, csv: string, rowCount: number, rowLimit: number, truncated: boolean, format: string) {
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'XLSX' || format === 'EXCEL') {
      const buffer = this.renderXlsxBuffer(csv);
      return { fileName: `${fileNameBase}-${date}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: buffer.toString('base64'), rowCount, rowLimit, truncated };
    }
    return { fileName: `${fileNameBase}-${date}.csv`, mimeType: 'text/csv;charset=utf-8', content: `\uFEFF${csv}`, rowCount, rowLimit, truncated };
  }

  async exportCsv(user: AuthUser, entity?: string) { return this.exportMasterData(user, entity ?? 'products', 'CSV'); }
  async exportExcel(user: AuthUser, entity?: string) { return this.exportMasterData(user, entity ?? 'products', 'XLSX'); }
  async exportData(user: AuthUser, entity?: string, format?: string) { return this.exportMasterData(user, entity, format); }
  async genericExport(user: AuthUser, entity?: string, format?: string) { return this.exportMasterData(user, entity, format); }
  async export(user: AuthUser, entity?: string, format?: string) { return this.exportMasterData(user, entity, format); }

}
