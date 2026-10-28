import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | any;

export type WarehouseTaxScope =
  | 'SALE'
  | 'PURCHASE'
  | 'EXPENSE'
  | 'ASSET'
  | 'PAYROLL'
  | 'SHIPPING'
  | 'WITHHOLDING'
  | 'OTHER';

export type WarehouseTaxResolverInput = {
  companyId: string;
  warehouseId?: string | null;
  scope?: WarehouseTaxScope | string | null;
  effectiveAt?: Date;
  fallbackToCompany?: boolean;
};

/**
 * Canonical tax-per-warehouse resolver.
 *
 * Tax codes/rules may be scoped to a warehouse (`warehouseId`) or to the whole
 * company (`warehouseId IS NULL`, the company default). This resolver selects
 * the warehouse-specific tax code automatically when one exists and is active
 * for the requested scope/effective date, falling back to the company-level
 * default only when no warehouse-specific code is available.
 */
export async function resolveWarehouseTaxCode(
  client: DbClient,
  companyId: string,
  warehouseId?: string | null,
  scope?: WarehouseTaxScope | string | null,
  effectiveAt: Date = new Date(),
  fallbackToCompany: boolean = true,
): Promise<string | null> {
  if (!companyId) return null;

  const buildWhere = (targetWarehouseId: string | null) => ({
    companyId,
    warehouseId: targetWarehouseId,
    ...(scope ? { scope: scope as any } : {}),
    status: 'ACTIVE',
    AND: [
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: effectiveAt } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }] },
    ],
  });

  if (warehouseId) {
    const warehouseTaxCode = await client.taxCode.findFirst({
      where: buildWhere(warehouseId),
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (warehouseTaxCode?.id) return warehouseTaxCode.id;
  }

  if (fallbackToCompany) {
    const companyTaxCode = await client.taxCode.findFirst({
      where: buildWhere(null),
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (companyTaxCode?.id) return companyTaxCode.id;
  }

  return null;
}

export async function resolveWarehouseTax(
  client: DbClient,
  companyId: string,
  warehouseId?: string | null,
  scope?: WarehouseTaxScope | string | null,
  effectiveAt: Date = new Date(),
  fallbackToCompany: boolean = true,
): Promise<string | null> {
  return resolveWarehouseTaxCode(client, companyId, warehouseId, scope, effectiveAt, fallbackToCompany);
}

export async function resolveTaxForWarehouse(
  client: DbClient,
  companyId: string,
  warehouseId?: string | null,
  scope?: WarehouseTaxScope | string | null,
  effectiveAt: Date = new Date(),
  fallbackToCompany: boolean = true,
): Promise<string | null> {
  return resolveWarehouseTaxCode(client, companyId, warehouseId, scope, effectiveAt, fallbackToCompany);
}

export async function resolveTaxCodeForWarehouse(
  client: DbClient,
  companyId: string,
  warehouseId?: string | null,
  scope?: WarehouseTaxScope | string | null,
  effectiveAt: Date = new Date(),
  fallbackToCompany: boolean = true,
): Promise<string | null> {
  return resolveWarehouseTaxCode(client, companyId, warehouseId, scope, effectiveAt, fallbackToCompany);
}

export async function selectWarehouseTaxCode(
  client: DbClient,
  companyId: string,
  warehouseId?: string | null,
  scope?: WarehouseTaxScope | string | null,
  effectiveAt: Date = new Date(),
  fallbackToCompany: boolean = true,
): Promise<string | null> {
  return resolveWarehouseTaxCode(client, companyId, warehouseId, scope, effectiveAt, fallbackToCompany);
}

export async function resolveWarehouseTaxCodeId(
  ...args: Parameters<typeof resolveWarehouseTaxCode>
): Promise<string | null> {
  return resolveWarehouseTaxCode(...args);
}
