import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionTenantScope } from './transaction-uom';

type DbClient = Prisma.TransactionClient | PrismaService;

export type PurchaseUomProduct = {
  id: string;
  unit: string;
};

export type PurchaseUomInput = {
  productUnitId?: string;
  variantId?: string;
  barcodeCode?: string;
};

/**
 * Immutable purchase-UOM snapshot. Safe to persist on transaction rows so a later
 * master-data edit to ProductUnit.quantityFactor cannot rewrite what a purchase
 * order, request, receipt or return already meant.
 */
export type PurchaseUomSnapshot = {
  variantId: string | null;
  productUnitId: string | null;
  unitCode: string;
  quantityFactor: number;
  baseUnit: string;
  sourceBarcode: string | null;
};

function assertSafeFactor(quantityFactor: number): void {
  if (!Number.isSafeInteger(quantityFactor) || quantityFactor < 1) {
    throw new BadRequestException('Konversi unit pembelian tidak aman untuk stok integer.');
  }
}

async function assertActiveMasterUnit(client: DbClient, scope: TransactionTenantScope, code: string): Promise<void> {
  const active = await client.masterReference.findFirst({
    where: { companyId: scope.companyId, branchId: null, type: 'UNIT', code, isActive: true },
    select: { id: true },
  });
  if (!active) throw new BadRequestException(`Unit pembelian ${code} tidak aktif pada master UNIT perusahaan.`);
}

/**
 * Canonical purchase-UOM resolver shared by purchase request, purchase order and goods receipt.
 *
 * PurchaseOrderItem, GoodsReceiptItem and PurchaseRequestItem previously each carried their own
 * inline factor arithmetic. PO and GRN did, PR did not, which is why every PR-derived PO line
 * silently collapsed to factor 1. One helper keeps factor safety, variant matching, master-reference
 * validation and barcode resolution identical on all three documents.
 *
 * ProductUnit is the authority for conversion factors; a barcode is only a shortcut that may point
 * at the same ProductUnit, exactly as on the selling side. Integer physical stock stays canonical:
 * base quantity is always unitQuantity * quantityFactor and must be a safe integer >= 1.
 */
export async function resolvePurchaseUnitLine(
  client: DbClient,
  scope: TransactionTenantScope,
  product: PurchaseUomProduct,
  input: PurchaseUomInput,
): Promise<PurchaseUomSnapshot> {
  const baseUnit = product.unit.trim().toUpperCase();
  if (!baseUnit) throw new BadRequestException('Base unit produk belum dikonfigurasi dari master UNIT.');
  await assertActiveMasterUnit(client, scope, baseUnit);

  let unitCode = baseUnit;
  let quantityFactor = 1;
  let sourceBarcode: string | null = null;
  let productUnitId: string | null = input.productUnitId?.trim() || null;
  let variantId: string | null = input.variantId?.trim() || null;

  if (productUnitId) {
    const unit = await client.productUnit.findFirst({
      where: { id: productUnitId, productId: product.id, isActive: true, product: { companyId: scope.companyId } },
      select: { id: true, variantId: true, unitCode: true, quantityFactor: true, variant: { select: { isActive: true } } },
    });
    if (!unit) throw new BadRequestException('ProductUnit pembelian tidak valid/aktif untuk produk yang dipilih.');
    if (variantId && unit.variantId !== variantId) throw new BadRequestException('Variant pembelian tidak cocok dengan ProductUnit.');
    if (unit.variantId && !unit.variant?.isActive) throw new BadRequestException('Variant pembelian sudah tidak aktif.');
    productUnitId = unit.id;
    variantId = unit.variantId ?? variantId;
    unitCode = unit.unitCode.trim().toUpperCase();
    quantityFactor = Number(unit.quantityFactor);
  }

  const barcodeCode = input.barcodeCode?.trim();
  if (barcodeCode) {
    sourceBarcode = barcodeCode;
    const barcode = await client.productBarcode.findUnique({
      where: { code: sourceBarcode },
      select: {
        productId: true,
        variantId: true,
        productUnitId: true,
        unitCode: true,
        quantityFactor: true,
        variant: { select: { isActive: true } },
        productUnit: { select: { id: true, variantId: true, unitCode: true, quantityFactor: true, isActive: true, variant: { select: { isActive: true } } } },
      },
    });
    if (!barcode || barcode.productId !== product.id) {
      throw new BadRequestException(`Barcode ${sourceBarcode} tidak valid untuk produk yang dipilih.`);
    }
    if (barcode.productUnitId) {
      if (!barcode.productUnit?.isActive) throw new BadRequestException(`ProductUnit untuk barcode ${sourceBarcode} sudah tidak aktif.`);
      if (productUnitId && productUnitId !== barcode.productUnit.id) throw new BadRequestException('Barcode tidak cocok dengan ProductUnit yang dipilih.');
      productUnitId = barcode.productUnit.id;
      unitCode = barcode.productUnit.unitCode.trim().toUpperCase();
      quantityFactor = Number(barcode.productUnit.quantityFactor);
      variantId = barcode.productUnit.variantId ?? barcode.variantId ?? variantId;
      if (barcode.productUnit.variantId && !barcode.productUnit.variant?.isActive) throw new BadRequestException(`Variant ProductUnit untuk barcode ${sourceBarcode} sudah tidak aktif.`);
    } else {
      quantityFactor = Number(barcode.quantityFactor);
      unitCode = barcode.unitCode?.trim().toUpperCase() || baseUnit;
      variantId = barcode.variantId ?? variantId;
    }
    if (barcode.variantId && variantId && barcode.variantId !== variantId) {
      throw new BadRequestException('Barcode tidak cocok dengan variant yang dipilih.');
    }
    if (barcode.variantId && !barcode.variant?.isActive) throw new BadRequestException(`Variant barcode ${sourceBarcode} sudah tidak aktif.`);
  } else if (variantId) {
    const variant = await client.productVariant.findFirst({
      where: { id: variantId, productId: product.id, isActive: true },
      select: { id: true },
    });
    if (!variant) throw new BadRequestException('Variant pembelian tidak valid/aktif untuk produk yang dipilih.');
  }

  if (unitCode !== baseUnit) await assertActiveMasterUnit(client, scope, unitCode);
  assertSafeFactor(quantityFactor);
  if (quantityFactor > 1 && unitCode === baseUnit) {
    throw new BadRequestException(`Unit dengan factor > 1 wajib berbeda dari base unit ${baseUnit}.`);
  }

  return { variantId, productUnitId, unitCode, quantityFactor, baseUnit, sourceBarcode };
}

/** unitQuantity expressed in the selected purchase unit becomes canonical base quantity. */
export function toPurchaseBaseQuantity(unitQuantity: number, quantityFactor: number): number {
  if (!Number.isSafeInteger(unitQuantity) || unitQuantity < 1) {
    throw new BadRequestException('Jumlah unit pembelian harus bilangan bulat >= 1.');
  }
  assertSafeFactor(quantityFactor);
  const baseQuantity = unitQuantity * quantityFactor;
  if (!Number.isSafeInteger(baseQuantity) || baseQuantity < 1) {
    throw new BadRequestException('Hasil konversi unit pembelian melebihi batas quantity integer yang aman.');
  }
  return baseQuantity;
}

/** Per purchase-unit cost becomes the canonical per base-unit cost used by inventory and accounting. */
export function toPurchaseBaseUnitCost(purchaseUnitCost: Prisma.Decimal, quantityFactor: number): Prisma.Decimal {
  assertSafeFactor(quantityFactor);
  return purchaseUnitCost.div(quantityFactor).toDecimalPlaces(6);
}