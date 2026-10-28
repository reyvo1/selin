import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { serializableTx } from '../common/serializable-tx';
import { consumeAvailableLocationStock, depositLocationStock } from '../common/location-inventory';
import { CreateTradeInDto } from './dto/create-trade-in.dto';

type TenantScope = { companyId: string; branchId: string };

export class CompleteTradeInDto {
  warehouseId?: string;
  quantity?: number;
  notes?: string;
}

@Injectable()
export class TradeInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingCoreService,
  ) {}

  private scope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new NotFoundException('Tenant context required');
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  async list(user: AuthUser) {
    const scope = this.scope(user);
    return this.prisma.tradeIn.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthUser, dto: CreateTradeInDto) {
    const scope = this.scope(user);

    const original = await this.prisma.product.findFirst({
      where: { id: dto.originalProductId },
      select: { id: true },
    });
    if (!original) throw new NotFoundException('Produk asli tidak ditemukan.');

    if (dto.newProductId) {
      const next = await this.prisma.product.findFirst({
        where: { id: dto.newProductId },
        select: { id: true },
      });
      if (!next) throw new NotFoundException('Produk baru tidak ditemukan.');
    }

    const tradeValue = new Prisma.Decimal(String(dto.tradeValue ?? ''));
    if (!tradeValue.isFinite() || tradeValue.lessThan(0)) {
      throw new BadRequestException('tradeValue tidak valid.');
    }

    return this.prisma.tradeIn.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        originalProductId: dto.originalProductId,
        newProductId: dto.newProductId,
        tradeValue: tradeValue.toDecimalPlaces(2),
        status: (dto.status ?? 'DRAFT').trim() || 'DRAFT',
      },
    });
  }

  async complete(id: string, dto: CompleteTradeInDto, user: AuthUser) {
    const scope = this.scope(user);
    return serializableTx(this.prisma, async (tx) => {
      const row = await tx.tradeIn.findFirst({
        where: { id, companyId: scope.companyId, branchId: scope.branchId },
      });
      if (!row) throw new NotFoundException('Trade-in tidak ditemukan.');
      if (row.status !== 'DRAFT') {
        throw new BadRequestException(`Trade-in berstatus ${row.status}, tidak dapat diselesaikan.`);
      }

      const originalProduct = await tx.product.findFirst({
        where: { id: row.originalProductId, companyId: scope.companyId },
      });
      if (!originalProduct) throw new NotFoundException('Produk asli tidak ditemukan.');

      const newProduct = row.newProductId
        ? await tx.product.findFirst({ where: { id: row.newProductId, companyId: scope.companyId } })
        : null;
      if (row.newProductId && !newProduct) throw new NotFoundException('Produk baru tidak ditemukan.');

      const quantity = dto.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantity harus integer positif.');
      }

      let warehouse = null as any;
      if (dto.warehouseId) {
        warehouse = await tx.warehouse.findFirst({
          where: { id: dto.warehouseId, branchId: scope.branchId, branch: { companyId: scope.companyId } },
        });
      } else {
        warehouse = await tx.warehouse.findFirst({
          where: { branchId: scope.branchId, branch: { companyId: scope.companyId }, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });
      }
      if (!warehouse) throw new BadRequestException('Gudang tidak ditemukan untuk branch aktif.');

      const postedAt = new Date();
      const tradeValue = new Prisma.Decimal(row.tradeValue);

      // Stok bekas: terima produk asli ke inventory.
      const originalLocation = await depositLocationStock(tx, {
        warehouseId: warehouse.id,
        productId: row.originalProductId,
        quantity,
      });
      const originalInventory = await tx.inventory.upsert({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: row.originalProductId } },
        create: { warehouseId: warehouse.id, productId: row.originalProductId, quantity, available: quantity },
        update: { quantity: { increment: quantity }, available: { increment: quantity } },
      });
      const originalMovement = await tx.inventoryMovement.create({
        data: {
          warehouseId: warehouse.id,
          locationId: originalLocation.locationId,
          productId: row.originalProductId,
          type: 'ADJUSTMENT_IN',
          quantity,
          balanceAfter: originalInventory.quantity,
          referenceType: 'TradeIn',
          referenceId: row.id,
          occurredAt: postedAt,
        },
      });

      // Stok produk baru: keluarkan dari inventory (jika ada produk baru).
      if (newProduct) {
        const newInventory = await tx.inventory.findUnique({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: newProduct.id } },
        });
        if (!newInventory || newInventory.available < quantity || newInventory.quantity < quantity) {
          throw new BadRequestException('Stok produk baru tidak mencukupi untuk trade-in.');
        }
        const allocations = await consumeAvailableLocationStock(tx, {
          warehouseId: warehouse.id,
          productId: newProduct.id,
          quantity,
        });
        const changed = await tx.inventory.updateMany({
          where: { id: newInventory.id, quantity: { gte: quantity }, available: { gte: quantity } },
          data: { quantity: { decrement: quantity }, available: { decrement: quantity } },
        });
        if (changed.count !== 1) {
          throw new BadRequestException('Saldo produk baru berubah saat posting trade-in. Ulangi transaksi.');
        }
        const after = await tx.inventory.findUniqueOrThrow({ where: { id: newInventory.id } });
        for (const allocation of allocations) {
          await tx.inventoryMovement.create({
            data: {
              warehouseId: warehouse.id,
              locationId: allocation.locationId,
              productId: newProduct.id,
              type: 'ADJUSTMENT_OUT',
              quantity: -allocation.quantity,
              balanceAfter: after.quantity,
              referenceType: 'TradeIn',
              referenceId: row.id,
              occurredAt: postedAt,
            },
          });
        }
      }

      // Jurnal.
      const event = await this.accounting.postOperationalEvent(tx, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        eventType: 'TRADE_IN',
        sourceType: 'TradeIn',
        sourceId: row.id,
        idempotencyKey: `trade-in-complete:${row.id}`,
        businessDate: postedAt,
        amounts: { inventory: tradeValue, tradeValue },
        accountCodes: { inventory: '1301', revenue: '4103' },
        lines: [
          { itemType: 'Product', itemId: row.originalProductId, description: originalProduct.name, quantity, unitAmount: tradeValue, netAmount: tradeValue, grossAmount: tradeValue, dimensions: { warehouseId: warehouse.id } },
        ],
        context: { tradeInId: row.id, originalProductId: row.originalProductId, newProductId: row.newProductId, warehouseId: warehouse.id },
      });

      const updated = await tx.tradeIn.update({
        where: { id: row.id },
        data: { status: 'COMPLETED' },
      });

      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'COMPLETE_TRADE_IN',
          entityType: 'TradeIn',
          entityId: row.id,
          payload: { branchId: scope.branchId, warehouseId: warehouse.id, quantity, accountingEventId: event.id },
        },
      });

      return updated;
    });
  }
}
