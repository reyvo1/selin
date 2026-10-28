import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, OpeningBalanceStatus, OpeningBalanceType, OpeningLedgerKind, OpeningLedgerStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { InventoryCostingService } from '../inventory/costing.service';
import { adjustLocationStock, depositLocationStock } from '../common/location-inventory';
import { AuthUser } from '../auth/auth.types';
import { hashPayload } from '../common/idempotency';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelOpeningBalanceBatchDto,
  CreateOpeningBalanceBatchDto,
  OpeningBalanceRowDto,
  PreviewOpeningBalanceBatchDto,
  RevalidateOpeningBalanceBatchDto,
  ReverseOpeningBalanceBatchDto,
} from './dto/opening-balance.dto';

const MAX_ROWS = 1000;
const MAX_PREVIEW_ERRORS = 100;
const LOCKED_STATUSES: OpeningBalanceStatus[] = [OpeningBalanceStatus.APPROVED, OpeningBalanceStatus.POSTING, OpeningBalanceStatus.POSTED];
const BALANCE_SHEET_TYPES: AccountType[] = [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY];
const FEATURE_KEY = 'accounting.opening_and_year_end';
const ROW_FIELDS = [
  'productId', 'warehouseId', 'locationCode', 'batchNumber', 'expiryDate', 'quantity', 'unitCost',
  'customerId', 'supplierId', 'documentNumber', 'documentDate', 'dueDate', 'subtotal', 'taxCodeId',
  'taxCodeVersion', 'taxAmount', 'total', 'paidAmount', 'accountCode', 'debit', 'credit', 'description',
] as const;
const ROW_FIELD_BY_LOWER = new Map<string, string>(ROW_FIELDS.map((field) => [field.toLowerCase(), field]));

type TenantScope = { companyId: string; branchId: string };
type DbClient = Prisma.TransactionClient | PrismaService;
type RowIssue = { rowNumber: number; field?: string; code: string; message: string };
type InputRow = { rowNumber: number; raw: Record<string, unknown> };

type ProductRef = { id: string; name: string; isActive: boolean; trackBatch: boolean; trackExpiry: boolean; trackSerial: boolean };
type WarehouseRef = { id: string; code: string; isActive: boolean; branchId: string };
type AccountRef = { code: string; name: string; type: AccountType; isActive: boolean };
type TaxCodeRef = { id: string; code: string; version: number; rate: Prisma.Decimal; inclusive: boolean };

type ReferenceContext = {
  products: Map<string, ProductRef>;
  warehouses: Map<string, WarehouseRef>;
  locations: Map<string, { code: string; isActive: boolean }>;
  customers: Set<string>;
  suppliers: Set<string>;
  accounts: Map<string, AccountRef>;
  taxCodes: Map<string, TaxCodeRef>;
  existingDocuments: Set<string>;
};

type PreparedRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  payloadHash: string;
  data: Omit<Prisma.OpeningBalanceRowCreateManyInput, 'batchId'>;
};

type Staging = {
  type: OpeningBalanceType;
  cutoverDate: Date;
  sourceChecksum: string;
  rows: PreparedRow[];
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  errorIssues: RowIssue[];
  batchAccounts: { controlAccountCode?: string; offsetAccountCode?: string; suspenseAccountCode?: string };
};

class OpeningRowError extends Error {
  constructor(readonly code: string, message: string, readonly field?: string) {
    super(message);
    this.name = 'OpeningRowError';
  }
}

@Injectable()
export class OpeningBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingCoreService,
    private readonly costing: InventoryCostingService = new InventoryCostingService(),
  ) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: 'Pengguna belum memiliki company dan branch yang valid.' });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async assertFeatureEnabled(client: DbClient, scope: TenantScope): Promise<void> {
    const flags = await client.featureFlag.findMany({
      where: {
        key: FEATURE_KEY,
        OR: [
          { companyId: scope.companyId, branchId: scope.branchId, userId: null },
          { companyId: scope.companyId, branchId: null, userId: null },
          { companyId: null, branchId: null, userId: null },
        ],
      },
    });
    const branchFlag = flags.find((flag) => flag.companyId === scope.companyId && flag.branchId === scope.branchId);
    const companyFlag = flags.find((flag) => flag.companyId === scope.companyId && flag.branchId === null);
    const globalFlag = flags.find((flag) => flag.companyId === null && flag.branchId === null);
    const effective = branchFlag ?? companyFlag ?? globalFlag;
    if (!effective?.enabled) {
      throw new ForbiddenException({
        code: 'OPENING_BALANCE_DISABLED',
        message: `Fitur ${FEATURE_KEY} belum diaktifkan untuk company dan branch pengguna.`,
      });
    }
  }

  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const field of ROW_FIELDS) {
      const value = row[field];
      if (value === undefined || value === null) {
        normalized[field] = null;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        normalized[field] = trimmed === '' ? null : trimmed;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        normalized[field] = value;
      } else {
        normalized[field] = String(value);
      }
    }
    return normalized;
  }

  private text(raw: Record<string, unknown>, field: string, required = false): string | undefined {
    const value = raw[field];
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (!text) {
      if (required) throw new OpeningRowError('OPENING_ROW_REQUIRED_FIELD', `Kolom ${field} wajib diisi.`, field);
      return undefined;
    }
    return text;
  }

  private integer(raw: Record<string, unknown>, field: string, required = false): number | undefined {
    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      if (required) throw new OpeningRowError('OPENING_ROW_REQUIRED_FIELD', `Kolom ${field} wajib diisi.`, field);
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new OpeningRowError('OPENING_ROW_QUANTITY_INVALID', `Kolom ${field} harus bilangan bulat positif.`, field);
    }
    return parsed;
  }

  private money(raw: Record<string, unknown>, field: string, required = false, scale = 2): Prisma.Decimal | undefined {
    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      if (required) throw new OpeningRowError('OPENING_ROW_REQUIRED_FIELD', `Kolom ${field} wajib diisi.`, field);
      return undefined;
    }
    let parsed: Prisma.Decimal;
    try {
      parsed = new Prisma.Decimal(value as Prisma.Decimal.Value);
    } catch {
      throw new OpeningRowError('OPENING_ROW_AMOUNT_INVALID', `Kolom ${field} bukan angka yang valid.`, field);
    }
    if (!parsed.isFinite()) throw new OpeningRowError('OPENING_ROW_AMOUNT_INVALID', `Kolom ${field} bukan angka yang valid.`, field);
    if (parsed.isNegative()) throw new OpeningRowError('OPENING_ROW_AMOUNT_INVALID', `Kolom ${field} tidak boleh negatif.`, field);
    if (parsed.decimalPlaces() > scale) {
      throw new OpeningRowError('OPENING_ROW_AMOUNT_INVALID', `Kolom ${field} maksimal ${scale} angka desimal.`, field);
    }
    return parsed;
  }

  private date(raw: Record<string, unknown>, field: string, required = false): Date | undefined {
    const value = raw[field];
    if (value === undefined || value === null || value === '') {
      if (required) throw new OpeningRowError('OPENING_ROW_REQUIRED_FIELD', `Kolom ${field} wajib diisi.`, field);
      return undefined;
    }
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw new OpeningRowError('OPENING_ROW_DATE_INVALID', `Kolom ${field} bukan tanggal yang valid.`, field);
    return parsed;
  }

  private parseCursor(value?: string): { createdAt: Date; id: string } | undefined {
    if (!value) return undefined;
    const cursor = decodeCursor<{ createdAt?: string; id?: string }>(value);
    if (!cursor?.createdAt || !cursor.id) throw new BadRequestException({ code: 'OPENING_BATCH_CURSOR_INVALID', message: 'cursor tidak valid.' });
    const createdAt = new Date(cursor.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new BadRequestException({ code: 'OPENING_BATCH_CURSOR_INVALID', message: 'cursor tidak valid.' });
    return { createdAt, id: cursor.id };
  }

  private rowCursor(value?: string): string | undefined {
    if (!value) return undefined;
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new BadRequestException({ code: 'OPENING_ROW_CURSOR_INVALID', message: 'cursor tidak valid.' });
    return value;
  }

  private assertBatchAccounts(staging: Staging, refs: ReferenceContext): void {
    const codes = [staging.batchAccounts.controlAccountCode, staging.batchAccounts.offsetAccountCode, staging.batchAccounts.suspenseAccountCode]
      .filter((code): code is string => Boolean(code));
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException({ code: 'OPENING_BATCH_ACCOUNT_DUPLICATE', message: 'Akun kontrol, lawan, dan suspense harus berbeda.' });
    }
    for (const code of codes) {
      const account = refs.accounts.get(code);
      if (!account || !account.isActive) {
        throw new BadRequestException({ code: 'OPENING_BATCH_ACCOUNT_INVALID', message: `Akun batch ${code} tidak ditemukan atau tidak aktif.` });
      }
    }
    if (staging.type === 'AR' || staging.type === 'AP') {
      const control = staging.batchAccounts.controlAccountCode;
      if (!control) {
        throw new BadRequestException({ code: 'OPENING_BATCH_CONTROL_ACCOUNT_REQUIRED', message: `Akun kontrol ${staging.type} wajib diisi.` });
      }
      const account = refs.accounts.get(control);
      const expected: AccountType = staging.type === 'AR' ? AccountType.ASSET : AccountType.LIABILITY;
      if (!account || account.type !== expected) {
        throw new BadRequestException({ code: 'OPENING_BATCH_CONTROL_ACCOUNT_INVALID', message: `Akun kontrol ${staging.type} harus bertipe ${expected}.` });
      }
    }
  }

  private async loadReferences(client: DbClient, scope: TenantScope, type: OpeningBalanceType, rows: InputRow[], excludeBatchId?: string): Promise<ReferenceContext> {
    const values = (field: string): string[] => [...new Set(rows.map((row) => String(row.raw[field] ?? '').trim()).filter(Boolean))];
    const productIds = values('productId');
    const warehouseIds = values('warehouseId');
    const locationCodes = values('locationCode');
    const customerIds = values('customerId');
    const supplierIds = values('supplierId');
    const taxCodeIds = values('taxCodeId');
    const documentNumbers = values('documentNumber');
    const accountCodes = values('accountCode');

    const [products, warehouses, locations, customers, suppliers, taxCodes, documents, stagedRows, accounts] = await Promise.all([
      productIds.length ? client.product.findMany({ where: { id: { in: productIds }, companyId: scope.companyId }, select: { id: true, name: true, isActive: true, trackBatch: true, trackExpiry: true, trackSerial: true } }) : [],
      warehouseIds.length ? client.warehouse.findMany({ where: { id: { in: warehouseIds }, branchId: scope.branchId }, select: { id: true, code: true, isActive: true, branchId: true } }) : [],
      warehouseIds.length && locationCodes.length ? client.warehouseLocation.findMany({ where: { warehouseId: { in: warehouseIds }, code: { in: locationCodes } }, select: { code: true, isActive: true, warehouseId: true } }) : [],
      customerIds.length && type === 'AR' ? client.customer.findMany({ where: { id: { in: customerIds }, companyId: scope.companyId }, select: { id: true } }) : [],
      supplierIds.length && type === 'AP' ? client.supplier.findMany({ where: { id: { in: supplierIds }, companyId: scope.companyId }, select: { id: true } }) : [],
      taxCodeIds.length ? client.taxCode.findMany({ where: { id: { in: taxCodeIds }, companyId: scope.companyId }, select: { id: true, code: true, version: true, rate: true, inclusive: true } }) : [],
      (type === 'AR' || type === 'AP') && documentNumbers.length
        ? client.openingLedgerDocument.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId, kind: (type === 'AR' ? 'AR' : 'AP') as OpeningLedgerKind, documentNumber: { in: documentNumbers } }, select: { documentNumber: true } })
        : [],
      (type === 'AR' || type === 'AP') && documentNumbers.length
        ? client.openingBalanceRow.findMany({
            where: {
              documentNumber: { in: documentNumbers },
              ...(excludeBatchId ? { batchId: { not: excludeBatchId } } : {}),
              batch: { companyId: scope.companyId, branchId: scope.branchId, type, status: { not: OpeningBalanceStatus.CANCELLED } },
            },
            select: { documentNumber: true },
          })
        : [],
      accountCodes.length ? client.account.findMany({ where: { branchId: scope.branchId, code: { in: accountCodes } }, select: { code: true, name: true, type: true, isActive: true } }) : [],
    ]);

    return {
      products: new Map(products.map((product) => [product.id, product])),
      warehouses: new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
      locations: new Map(locations.map((location) => [`${location.warehouseId}:${location.code}`, { code: location.code, isActive: location.isActive }])),
      customers: new Set(customers.map((customer) => customer.id)),
      suppliers: new Set(suppliers.map((supplier) => supplier.id)),
      accounts: new Map(accounts.map((account) => [account.code, account])),
      taxCodes: new Map(taxCodes.map((tax) => [tax.id, tax])),
      existingDocuments: new Set([
        ...documents.map((document) => document.documentNumber),
        ...stagedRows.map((document) => document.documentNumber).filter((number): number is string => Boolean(number)),
      ]),
    };
  }

  private prepareRow(type: OpeningBalanceType, input: InputRow, cutoverDate: Date, refs: ReferenceContext, batchAccounts: Staging['batchAccounts'], seenDocuments: Set<string>): PreparedRow {
    const raw = this.normalizeRow(input.raw);
    const payloadHash = hashPayload(raw);
    const base = { rowNumber: input.rowNumber, status: 'VALID', payloadHash, rawPayload: raw as Prisma.InputJsonValue };
    try {
      if (type === 'STOCK') {
        const productId = this.text(raw, 'productId', true)!;
        const product = refs.products.get(productId);
        if (!product) throw new OpeningRowError('OPENING_STOCK_PRODUCT_NOT_FOUND', 'Produk tidak ditemukan pada company pengguna.', 'productId');
        if (product.trackSerial) throw new OpeningRowError('OPENING_STOCK_SERIAL_UNSUPPORTED', 'Saldo awal produk berserial belum didukung pada staging ini.', 'productId');
        const warehouseId = this.text(raw, 'warehouseId', true)!;
        const warehouse = refs.warehouses.get(warehouseId);
        if (!warehouse) throw new OpeningRowError('OPENING_STOCK_WAREHOUSE_NOT_FOUND', 'Gudang tidak ditemukan pada branch pengguna.', 'warehouseId');
        const locationCode = this.text(raw, 'locationCode');
        if (locationCode) {
          const location = refs.locations.get(`${warehouseId}:${locationCode}`);
          if (!location) throw new OpeningRowError('OPENING_STOCK_LOCATION_NOT_FOUND', 'Lokasi gudang tidak ditemukan.', 'locationCode');
        }
        const batchNumber = this.text(raw, 'batchNumber');
        if (product.trackBatch && !batchNumber) throw new OpeningRowError('OPENING_STOCK_BATCH_REQUIRED', 'Nomor batch wajib untuk produk ini.', 'batchNumber');
        if (!product.trackBatch && batchNumber) throw new OpeningRowError('OPENING_STOCK_BATCH_UNEXPECTED', 'Produk ini tidak memakai batch.', 'batchNumber');
        const expiryDate = this.date(raw, 'expiryDate');
        if (product.trackExpiry && !expiryDate) throw new OpeningRowError('OPENING_STOCK_EXPIRY_REQUIRED', 'Tanggal kedaluwarsa wajib untuk produk ini.', 'expiryDate');
        if (!product.trackExpiry && expiryDate) throw new OpeningRowError('OPENING_STOCK_EXPIRY_UNEXPECTED', 'Produk ini tidak memakai tracking kedaluwarsa.', 'expiryDate');
        if (expiryDate && expiryDate.getTime() <= cutoverDate.getTime()) throw new OpeningRowError('OPENING_STOCK_EXPIRED_AT_CUTOVER', 'Batch sudah kedaluwarsa pada tanggal cutover.', 'expiryDate');
        const quantity = this.integer(raw, 'quantity', true)!;
        const unitCost = this.money(raw, 'unitCost', true, 4)!;
        const value = unitCost.mul(quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        const accountCode = this.text(raw, 'accountCode');
        if (accountCode) {
          const account = refs.accounts.get(accountCode);
          if (!account || !account.isActive) throw new OpeningRowError('OPENING_STOCK_ACCOUNT_INVALID', 'Akun baris tidak ditemukan atau tidak aktif.', 'accountCode');
        }
        return {
          rowNumber: input.rowNumber, raw, payloadHash,
          data: {
            ...base, productId, warehouseId, locationCode, batchNumber, expiryDate, quantity, unitCost,
            subtotal: value, total: value, debit: value, credit: new Prisma.Decimal(0), accountCode, description: this.text(raw, 'description'),
          },
        };
      }

      if (type === 'AR' || type === 'AP') {
        const customerId = this.text(raw, 'customerId');
        const supplierId = this.text(raw, 'supplierId');
        if (type === 'AR') {
          if (!customerId) throw new OpeningRowError('OPENING_LEDGER_CUSTOMER_REQUIRED', 'Customer wajib untuk saldo awal AR.', 'customerId');
          if (supplierId) throw new OpeningRowError('OPENING_LEDGER_SUPPLIER_UNEXPECTED', 'Supplier tidak boleh diisi untuk AR.', 'supplierId');
          if (!refs.customers.has(customerId)) throw new OpeningRowError('OPENING_LEDGER_CUSTOMER_NOT_FOUND', 'Customer tidak ditemukan pada company pengguna.', 'customerId');
        } else {
          if (!supplierId) throw new OpeningRowError('OPENING_LEDGER_SUPPLIER_REQUIRED', 'Supplier wajib untuk saldo awal AP.', 'supplierId');
          if (customerId) throw new OpeningRowError('OPENING_LEDGER_CUSTOMER_UNEXPECTED', 'Customer tidak boleh diisi untuk AP.', 'customerId');
          if (!refs.suppliers.has(supplierId)) throw new OpeningRowError('OPENING_LEDGER_SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan pada company pengguna.', 'supplierId');
        }
        const documentNumber = this.text(raw, 'documentNumber', true)!;
        const documentDate = this.date(raw, 'documentDate', true)!;
        const dueDate = this.date(raw, 'dueDate', true)!;
        if (documentDate.getTime() > cutoverDate.getTime()) throw new OpeningRowError('OPENING_LEDGER_DOCUMENT_AFTER_CUTOVER', 'Tanggal dokumen tidak boleh melewati tanggal cutover.', 'documentDate');
        if (dueDate.getTime() < documentDate.getTime()) throw new OpeningRowError('OPENING_LEDGER_DUE_BEFORE_DOCUMENT', 'Tanggal jatuh tempo tidak boleh sebelum tanggal dokumen.', 'dueDate');
        const documentKey = `${type}:${documentNumber}`;
        if (seenDocuments.has(documentKey) || refs.existingDocuments.has(documentNumber)) {
          throw new OpeningRowError('OPENING_LEDGER_DOCUMENT_DUPLICATE', 'Nomor dokumen sudah ada pada batch atau saldo awal sebelumnya.', 'documentNumber');
        }
        seenDocuments.add(documentKey);
        const taxCodeId = this.text(raw, 'taxCodeId');
        const requestedTaxVersion = this.integer(raw, 'taxCodeVersion');
        let taxRateSnapshot: Prisma.Decimal | undefined;
        let taxCodeVersion: number | undefined;
        let taxCode: TaxCodeRef | undefined;
        const inputTaxAmount = this.money(raw, 'taxAmount');
        let taxAmount = inputTaxAmount ?? new Prisma.Decimal(0);
        if (taxCodeId) {
          taxCode = refs.taxCodes.get(taxCodeId);
          if (!taxCode) throw new OpeningRowError('OPENING_LEDGER_TAX_CODE_NOT_FOUND', 'Kode pajak tidak ditemukan pada company pengguna.', 'taxCodeId');
          if (requestedTaxVersion && requestedTaxVersion !== taxCode.version) throw new OpeningRowError('OPENING_LEDGER_TAX_VERSION_MISMATCH', 'Versi kode pajak tidak sesuai.', 'taxCodeVersion');
          taxCodeVersion = taxCode.version;
          taxRateSnapshot = taxCode.rate;
        } else if (taxAmount.gt(0)) {
          throw new OpeningRowError('OPENING_LEDGER_TAX_CODE_REQUIRED', 'Kode pajak wajib diisi bila ada nilai pajak.', 'taxCodeId');
        }
        let subtotal = this.money(raw, 'subtotal');
        let total = this.money(raw, 'total');
        if (taxCode && !inputTaxAmount) {
          if (subtotal) {
            taxAmount = taxCode.inclusive
              ? subtotal.mul(taxCode.rate).div(taxCode.rate.add(100)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
              : subtotal.mul(taxCode.rate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          } else if (total) {
            subtotal = total.mul(100).div(taxCode.rate.add(100)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            taxAmount = total.sub(subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          }
        } else if (!subtotal && total && taxCode) {
          subtotal = total.sub(taxAmount);
        }
        if (subtotal && subtotal.isNegative()) throw new OpeningRowError('OPENING_LEDGER_AMOUNT_INVALID', 'Subtotal tidak boleh negatif.', 'subtotal');
        subtotal ??= new Prisma.Decimal(0);
        if (!total) total = taxCode?.inclusive ? subtotal : subtotal.add(taxAmount);
        if (total.lt(subtotal)) throw new OpeningRowError('OPENING_LEDGER_TOTAL_INVALID', 'Total tidak boleh lebih kecil dari subtotal.', 'total');
        const paidAmount = this.money(raw, 'paidAmount') ?? new Prisma.Decimal(0);
        if (paidAmount.gt(total)) throw new OpeningRowError('OPENING_LEDGER_PAID_EXCEEDS_TOTAL', 'Nilai dibayar tidak boleh melebihi total.', 'paidAmount');
        const outstanding = total.sub(paidAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (!outstanding.gt(0)) throw new OpeningRowError('OPENING_LEDGER_OUTSTANDING_ZERO', 'Saldo awal AR/AP harus memiliki outstanding lebih dari nol.', 'total');
        const accountCode = this.text(raw, 'accountCode') ?? batchAccounts.controlAccountCode;
        if (accountCode) {
          const account = refs.accounts.get(accountCode);
          if (!account || !account.isActive) throw new OpeningRowError('OPENING_LEDGER_ACCOUNT_INVALID', 'Akun baris tidak ditemukan atau tidak aktif.', 'accountCode');
        }
        return {
          rowNumber: input.rowNumber, raw, payloadHash,
          data: {
            ...base, customerId, supplierId, documentNumber, documentDate, dueDate, subtotal,
            taxCodeId, taxCodeVersion, taxRateSnapshot, taxAmount, total, paidAmount, accountCode,
            debit: type === 'AR' ? outstanding : new Prisma.Decimal(0),
            credit: type === 'AP' ? outstanding : new Prisma.Decimal(0),
            description: this.text(raw, 'description'),
          },
        };
      }

      const accountCode = this.text(raw, 'accountCode', true)!;
      const account = refs.accounts.get(accountCode);
      if (!account || !account.isActive) throw new OpeningRowError('OPENING_GL_ACCOUNT_INVALID', 'Akun GL tidak ditemukan atau tidak aktif.', 'accountCode');
      if (!BALANCE_SHEET_TYPES.includes(account.type)) {
        throw new OpeningRowError('OPENING_GL_ACCOUNT_TYPE_INVALID', 'Saldo awal GL hanya boleh memakai akun aset, liabilitas, atau ekuitas.', 'accountCode');
      }
      const debit = this.money(raw, 'debit') ?? new Prisma.Decimal(0);
      const credit = this.money(raw, 'credit') ?? new Prisma.Decimal(0);
      if (debit.isZero() && credit.isZero()) throw new OpeningRowError('OPENING_GL_AMOUNT_REQUIRED', 'Debit atau kredit wajib lebih dari nol.', 'debit');
      if (debit.gt(0) && credit.gt(0)) throw new OpeningRowError('OPENING_GL_SINGLE_SIDE_REQUIRED', 'Satu baris GL hanya boleh berisi debit atau kredit.', 'debit');
      return {
        rowNumber: input.rowNumber, raw, payloadHash,
        data: {
          ...base, accountCode, debit, credit, subtotal: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0),
          total: debit.add(credit), paidAmount: new Prisma.Decimal(0), description: this.text(raw, 'description'),
        },
      };
    } catch (error) {
      if (!(error instanceof OpeningRowError)) throw error;
      return {
        rowNumber: input.rowNumber,
        raw,
        payloadHash,
        data: {
          rowNumber: input.rowNumber, status: 'ERROR', payloadHash, rawPayload: raw as Prisma.InputJsonValue,
          errorCode: error.code, errorMessage: error.message,
        },
      };
    }
  }

  private async stageValidation(client: DbClient, scope: TenantScope, dto: PreviewOpeningBalanceBatchDto, excludeBatchId?: string): Promise<Staging> {
    if (!Object.values(OpeningBalanceType).includes(dto.type as OpeningBalanceType)) {
      throw new BadRequestException({ code: 'OPENING_BATCH_TYPE_INVALID', message: 'Tipe saldo awal tidak valid.' });
    }
    const cutoverDate = new Date(dto.cutoverDate);
    if (Number.isNaN(cutoverDate.getTime())) throw new BadRequestException({ code: 'OPENING_CUTOVER_DATE_INVALID', message: 'cutoverDate tidak valid.' });
    const branch = await client.branch.findFirst({ where: { id: scope.branchId, companyId: scope.companyId }, select: { id: true, isActive: true } });
    if (!branch || !branch.isActive) throw new ForbiddenException({ code: 'OPENING_BRANCH_INVALID', message: 'Branch pengguna tidak ditemukan atau tidak aktif.' });
    const inputs = this.inputRows(dto);
    const refs = await this.loadReferences(client, scope, dto.type, inputs, excludeBatchId);
    const accountCodes = [
      dto.controlAccountCode?.trim(), dto.offsetAccountCode?.trim(), dto.suspenseAccountCode?.trim(),
      ...inputs.map((input) => String(input.raw.accountCode ?? '').trim()).filter(Boolean),
    ].filter((code): code is string => Boolean(code));
    if (accountCodes.length) {
      const found = await client.account.findMany({ where: { branchId: scope.branchId, code: { in: [...new Set(accountCodes)] } }, select: { code: true, name: true, type: true, isActive: true } });
      for (const account of found) refs.accounts.set(account.code, account);
    }
    const batchAccounts = {
      controlAccountCode: dto.controlAccountCode?.trim() || undefined,
      offsetAccountCode: dto.offsetAccountCode?.trim() || undefined,
      suspenseAccountCode: dto.suspenseAccountCode?.trim() || undefined,
    };
    const staging: Staging = {
      type: dto.type,
      cutoverDate,
      sourceChecksum: this.sourceChecksum(dto, inputs),
      rows: [],
      totalDebit: new Prisma.Decimal(0),
      totalCredit: new Prisma.Decimal(0),
      errorIssues: [],
      batchAccounts,
    };
    this.assertBatchAccounts(staging, refs);
    const seenDocuments = new Set<string>();
    staging.rows = inputs.map((input) => this.prepareRow(dto.type, input, cutoverDate, refs, batchAccounts, seenDocuments));
    for (const row of staging.rows) {
      if (row.data.status !== 'VALID') {
        staging.errorIssues.push({
          rowNumber: row.rowNumber,
          code: row.data.errorCode ?? 'OPENING_ROW_INVALID',
          message: row.data.errorMessage ?? 'Baris tidak valid.',
        });
      } else {
        staging.totalDebit = staging.totalDebit.add(new Prisma.Decimal(String(row.data.debit ?? 0)));
        staging.totalCredit = staging.totalCredit.add(new Prisma.Decimal(String(row.data.credit ?? 0)));
      }
    }
    if (staging.errorIssues.length === 0 && dto.type === 'GL' && !staging.totalDebit.equals(staging.totalCredit)) {
      throw new BadRequestException({
        code: 'OPENING_GL_UNBALANCED',
        message: `Total debit ${staging.totalDebit.toFixed(2)} tidak sama dengan total kredit ${staging.totalCredit.toFixed(2)}.`,
      });
    }
    if (staging.errorIssues.length === 0 && dto.type === 'GL') {
      await this.assertGlControlAccountsFree(client, scope, cutoverDate, staging, excludeBatchId);
    }
    return staging;
  }

  private async assertGlControlAccountsFree(client: DbClient, scope: TenantScope, cutoverDate: Date, staging: Staging, excludeBatchId?: string) {
    const codes = [...new Set(staging.rows
      .filter((row) => row.data.status === 'VALID' && row.data.accountCode)
      .map((row) => String(row.data.accountCode)))];
    if (!codes.length) return;
    const conflict = await client.openingBalanceBatch.findFirst({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        cutoverDate,
        type: { in: [OpeningBalanceType.STOCK, OpeningBalanceType.AR, OpeningBalanceType.AP] },
        status: { not: OpeningBalanceStatus.CANCELLED },
        controlAccountCode: { in: codes },
        ...(excludeBatchId ? { id: { not: excludeBatchId } } : {}),
      },
      select: { id: true, type: true, controlAccountCode: true },
    });
    if (conflict) {
      throw new BadRequestException({
        code: 'OPENING_GL_CONTROL_ACCOUNT_CONFLICT',
        message: `Akun ${conflict.controlAccountCode} sudah dicakup batch ${conflict.type} ${conflict.id}; GL hanya untuk akun residual.`,
      });
    }
  }

  private inputRows(dto: PreviewOpeningBalanceBatchDto): InputRow[] {
    const fileName = dto.sourceFileName?.trim();
    if (fileName && /\.(xlsx|xls)$/i.test(fileName)) {
      throw new BadRequestException({ code: 'OPENING_IMPORT_XLSX_PARSER_NOT_APPROVED', message: 'Parser XLSX belum disetujui; konversi file ke CSV terlebih dahulu.' });
    }
    if (dto.csv !== undefined && dto.rows !== undefined) {
      throw new BadRequestException({ code: 'OPENING_IMPORT_SOURCE_AMBIGUOUS', message: 'Kirim csv atau rows, tidak keduanya.' });
    }
    if (dto.csv !== undefined) {
      if (dto.csv.trimStart().startsWith('PK')) throw new BadRequestException({ code: 'OPENING_IMPORT_XLSX_PARSER_NOT_APPROVED', message: 'File terlihat seperti XLSX; parser XLSX belum disetujui.' });
      const rows = this.parseCsv(dto.csv);
      if (rows.length > MAX_ROWS) throw new BadRequestException({ code: 'OPENING_IMPORT_ROW_LIMIT', message: `Maksimal ${MAX_ROWS} baris per batch.` });
      if (!rows.length) throw new BadRequestException({ code: 'OPENING_IMPORT_EMPTY', message: 'CSV tidak memiliki baris data.' });
      return rows;
    }
    if (dto.rows !== undefined) {
      if (!dto.rows.length) throw new BadRequestException({ code: 'OPENING_IMPORT_EMPTY', message: 'rows tidak boleh kosong.' });
      if (dto.rows.length > MAX_ROWS) throw new BadRequestException({ code: 'OPENING_IMPORT_ROW_LIMIT', message: `Maksimal ${MAX_ROWS} baris per batch.` });
      return dto.rows.map((row, index) => ({ rowNumber: index + 1, raw: row as unknown as Record<string, unknown> }));
    }
    throw new BadRequestException({ code: 'OPENING_IMPORT_SOURCE_REQUIRED', message: 'Kirim csv atau rows.' });
  }

  private sourceChecksum(dto: PreviewOpeningBalanceBatchDto, inputs: InputRow[]): string {
    if (dto.csv !== undefined) return createHash('sha256').update(dto.csv, 'utf8').digest('hex');
    return hashPayload(inputs.map((input) => input.raw));
  }

  private parseCsv(csv: string): InputRow[] {
    const text = csv.replace(/^\uFEFF/, '');
    if (text.includes('\u0000')) throw new BadRequestException({ code: 'OPENING_IMPORT_BINARY_REJECTED', message: 'Konten biner tidak didukung; gunakan CSV teks.' });
    const records: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      if (quoted) {
        if (char === '"') {
          if (normalized[index + 1] === '"') { field += '"'; index += 1; }
          else quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"' && field === '') {
        quoted = true;
      } else if (char === ',') {
        row.push(field); field = '';
      } else if (char === '\n') {
        row.push(field); records.push(row); row = []; field = '';
      } else {
        field += char;
      }
    }
    if (quoted) throw new BadRequestException({ code: 'OPENING_IMPORT_CSV_INVALID', message: 'CSV memiliki kutip yang tidak ditutup.' });
    row.push(field);
    records.push(row);
    while (records.length && records[records.length - 1].every((value) => value.trim() === '')) records.pop();
    if (!records.length) throw new BadRequestException({ code: 'OPENING_IMPORT_EMPTY', message: 'CSV kosong.' });
    const headers = records.shift()!.map((value) => value.trim());
    if (!headers.length || headers.some((header) => !header)) throw new BadRequestException({ code: 'OPENING_IMPORT_CSV_INVALID', message: 'Header CSV tidak boleh kosong.' });
    const canonical = headers.map((header) => ROW_FIELD_BY_LOWER.get(header.toLowerCase()));
    if (canonical.some((header) => !header)) {
      const unknown = headers.filter((header) => !ROW_FIELD_BY_LOWER.has(header.toLowerCase()));
      throw new BadRequestException({ code: 'OPENING_IMPORT_COLUMN_UNKNOWN', message: `Kolom CSV tidak dikenal: ${unknown.join(', ')}.` });
    }
    if (new Set(canonical).size !== canonical.length) throw new BadRequestException({ code: 'OPENING_IMPORT_COLUMN_DUPLICATE', message: 'Header CSV tidak boleh duplikat.' });
    return records.map((values, index) => {
      if (values.length !== canonical.length) {
        throw new BadRequestException({ code: 'OPENING_IMPORT_CSV_INVALID', message: `Jumlah kolom baris ${index + 2} tidak sesuai header.` });
      }
      const raw: Record<string, unknown> = {};
      for (let position = 0; position < canonical.length; position += 1) raw[canonical[position]!] = values[position];
      return { rowNumber: index + 2, raw };
    });
  }

  private summary(batch: {
    id: string; type: OpeningBalanceType; cutoverDate: Date; status: OpeningBalanceStatus; sourceFileName: string | null;
    sourceChecksum: string | null; totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal; rowCount: number;
    validRowCount: number; errorRowCount: number; createdBy: string | null; approvedBy: string | null;
    postedAt: Date | null; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: batch.id,
      type: batch.type,
      cutoverDate: batch.cutoverDate.toISOString(),
      status: batch.status,
      sourceFileName: batch.sourceFileName,
      sourceChecksum: batch.sourceChecksum,
      totalDebit: batch.totalDebit.toFixed(2),
      totalCredit: batch.totalCredit.toFixed(2),
      rowCount: batch.rowCount,
      validRowCount: batch.validRowCount,
      errorRowCount: batch.errorRowCount,
      createdBy: batch.createdBy,
      approvedBy: batch.approvedBy,
      postedAt: batch.postedAt ? batch.postedAt.toISOString() : null,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }

  private stagingSummary(staging: Staging) {
    return {
      type: staging.type,
      cutoverDate: staging.cutoverDate.toISOString(),
      sourceChecksum: staging.sourceChecksum,
      rowCount: staging.rows.length,
      validRowCount: staging.rows.filter((row) => row.data.status === 'VALID').length,
      errorRowCount: staging.errorIssues.length,
      totalDebit: staging.totalDebit.toFixed(2),
      totalCredit: staging.totalCredit.toFixed(2),
      errors: staging.errorIssues.slice(0, MAX_PREVIEW_ERRORS),
      errorsTruncated: Math.max(0, staging.errorIssues.length - MAX_PREVIEW_ERRORS),
    };
  }

  async preview(user: AuthUser, dto: PreviewOpeningBalanceBatchDto) {
    const scope = this.requireTenantScope(user);
    const staging = await this.stageValidation(this.prisma, scope, { ...dto, dryRun: true });
    return { dryRun: true, ...this.stagingSummary(staging) };
  }

  async create(user: AuthUser, dto: CreateOpeningBalanceBatchDto) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const operationKey = dto.operationKey?.trim();
    if (!operationKey || operationKey.length < 8) throw new BadRequestException({ code: 'OPENING_OPERATION_KEY_REQUIRED', message: 'operationKey minimal 8 karakter untuk menyimpan batch.' });
    const cutoverDate = new Date(dto.cutoverDate);
    if (Number.isNaN(cutoverDate.getTime())) throw new BadRequestException({ code: 'OPENING_CUTOVER_DATE_INVALID', message: 'cutoverDate tidak valid.' });
    const inputs = this.inputRows(dto);
    const existing = await this.prisma.openingBalanceBatch.findUnique({ where: { companyId_operationKey: { companyId: scope.companyId, operationKey } } });
    if (existing) return this.replay(existing, scope, { type: dto.type, cutoverDate, sourceChecksum: this.sourceChecksum(dto, inputs) });
    const staging = await this.stageValidation(this.prisma, scope, dto);
    const errors = staging.errorIssues.length;
    try {
      const batch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.openingBalanceBatch.create({
          data: {
            companyId: scope.companyId,
            branchId: scope.branchId,
            type: staging.type,
            cutoverDate: staging.cutoverDate,
            sourceFileName: dto.sourceFileName?.trim() || null,
            sourceChecksum: staging.sourceChecksum,
            status: errors ? OpeningBalanceStatus.FAILED : OpeningBalanceStatus.VALIDATED,
            operationKey,
            controlAccountCode: staging.batchAccounts.controlAccountCode,
            offsetAccountCode: staging.batchAccounts.offsetAccountCode,
            suspenseAccountCode: staging.batchAccounts.suspenseAccountCode,
            totalDebit: staging.totalDebit,
            totalCredit: staging.totalCredit,
            rowCount: staging.rows.length,
            validRowCount: staging.rows.length - errors,
            errorRowCount: errors,
            createdBy: user.sub,
            rows: {
              createMany: {
                data: staging.rows.map((row) => row.data),
              },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: scope.companyId,
            userId: user.sub,
            action: 'OPENING_BALANCE_BATCH_STAGED',
            entityType: 'OpeningBalanceBatch',
            entityId: created.id,
            payload: {
              branchId: scope.branchId,
              type: created.type,
              rowCount: created.rowCount,
              validRowCount: created.validRowCount,
              errorRowCount: created.errorRowCount,
              totalDebit: created.totalDebit.toFixed(2),
              totalCredit: created.totalCredit.toFixed(2),
            },
          },
        });
        return created;
      });
      return this.summary(batch);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.openingBalanceBatch.findUnique({ where: { companyId_operationKey: { companyId: scope.companyId, operationKey } } });
        if (replay) return this.replay(replay, scope, staging);
      }
      throw error;
    }
  }

  private replay(existing: {
    id: string; branchId: string; type: OpeningBalanceType; cutoverDate: Date; sourceChecksum: string | null; status: OpeningBalanceStatus;
    sourceFileName: string | null; totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal; rowCount: number;
    validRowCount: number; errorRowCount: number; createdBy: string | null; approvedBy: string | null; postedAt: Date | null; createdAt: Date; updatedAt: Date;
  }, scope: TenantScope, expected: { type: OpeningBalanceType; cutoverDate: Date; sourceChecksum: string }) {
    const same = existing.branchId === scope.branchId
      && existing.type === expected.type
      && existing.cutoverDate.getTime() === expected.cutoverDate.getTime()
      && existing.sourceChecksum === expected.sourceChecksum;
    if (!same) {
      throw new ConflictException({ code: 'OPENING_OPERATION_KEY_CONFLICT', message: 'operationKey sudah dipakai untuk batch dengan payload berbeda.' });
    }
    return this.summary(existing);
  }

  async list(user: AuthUser, query: { type?: string; status?: string; limit?: string; cursor?: string }) {
    const scope = this.requireTenantScope(user);
    const type = query.type as OpeningBalanceType | undefined;
    if (type && !Object.values(OpeningBalanceType).includes(type)) throw new BadRequestException({ code: 'OPENING_BATCH_TYPE_INVALID', message: 'Tipe saldo awal tidak valid.' });
    const status = query.status as OpeningBalanceStatus | undefined;
    if (status && !Object.values(OpeningBalanceStatus).includes(status)) throw new BadRequestException({ code: 'OPENING_BATCH_STATUS_INVALID', message: 'Status batch tidak valid.' });
    const limit = parsePageLimit(query.limit);
    const cursor = this.parseCursor(query.cursor);
    const rows = await this.prisma.openingBalanceBatch.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
      },
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const page = toCursorPage(rows, limit, (batch) => ({ createdAt: batch.createdAt.toISOString(), id: batch.id }));
    return { ...page, items: page.items.map((batch) => this.summary(batch)) };
  }

  async get(user: AuthUser, id: string) {
    const scope = this.requireTenantScope(user);
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
      include: { _count: { select: { rows: true } } },
    });
    if (!batch) throw new NotFoundException({ code: 'OPENING_BATCH_NOT_FOUND', message: 'Batch saldo awal tidak ditemukan.' });
    return { ...this.summary(batch), persistedRowCount: batch._count.rows };
  }

  async rows(user: AuthUser, id: string, query: { status?: string; limit?: string; cursor?: string }) {
    const scope = this.requireTenantScope(user);
    const batch = await this.prisma.openingBalanceBatch.findFirst({ where: { id, companyId: scope.companyId, branchId: scope.branchId }, select: { id: true } });
    if (!batch) throw new NotFoundException({ code: 'OPENING_BATCH_NOT_FOUND', message: 'Batch saldo awal tidak ditemukan.' });
    const status = query.status?.trim();
    if (status && !['PENDING', 'VALID', 'ERROR'].includes(status)) throw new BadRequestException({ code: 'OPENING_ROW_STATUS_INVALID', message: 'Status baris tidak valid.' });
    const limit = parsePageLimit(query.limit);
    const cursor = this.rowCursor(query.cursor);
    const rows = await this.prisma.openingBalanceRow.findMany({
      where: { batchId: batch.id, ...(status ? { status } : {}) },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }],
      select: {
        id: true, rowNumber: true, status: true, productId: true, warehouseId: true, locationCode: true,
        batchNumber: true, expiryDate: true, quantity: true, unitCost: true, customerId: true, supplierId: true,
        documentNumber: true, documentDate: true, dueDate: true, subtotal: true, taxCodeId: true,
        taxCodeVersion: true, taxRateSnapshot: true, taxAmount: true, total: true, paidAmount: true,
        accountCode: true, debit: true, credit: true, description: true, errorCode: true, errorMessage: true,
        postedAt: true, createdAt: true,
      },
    });
    return toCursorPage(rows, limit, (row) => ({ id: row.id }));
  }

  async revalidate(user: AuthUser, id: string, dto: RevalidateOpeningBalanceBatchDto) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (LOCKED_STATUSES.includes(batch.status)) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_REVALIDATABLE', message: `Batch berstatus ${batch.status} tidak dapat divalidasi ulang.` });
    }
    const ledgerCount = await this.prisma.openingLedgerDocument.count({ where: { row: { batchId: batch.id } } });
    if (ledgerCount > 0) throw new BadRequestException({ code: 'OPENING_BATCH_HAS_LEDGER', message: 'Batch sudah memiliki dokumen ledger dan tidak dapat divalidasi ulang.' });
    const storedRows = await this.prisma.openingBalanceRow.findMany({ where: { batchId: batch.id }, orderBy: { rowNumber: 'asc' }, select: { rowNumber: true, rawPayload: true } });
    const inputs: InputRow[] = storedRows.map((row) => ({ rowNumber: row.rowNumber, raw: (row.rawPayload && typeof row.rawPayload === 'object' && !Array.isArray(row.rawPayload) ? row.rawPayload : {}) as Record<string, unknown> }));
    if (!inputs.length) throw new BadRequestException({ code: 'OPENING_BATCH_EMPTY', message: 'Batch tidak memiliki baris untuk divalidasi.' });
    const staging = await this.stageValidation(this.prisma, scope, {
      type: batch.type,
      cutoverDate: batch.cutoverDate.toISOString(),
      rows: inputs.map((input) => input.raw as OpeningBalanceRowDto),
      dryRun: true,
      controlAccountCode: batch.controlAccountCode ?? undefined,
      offsetAccountCode: batch.offsetAccountCode ?? undefined,
      suspenseAccountCode: batch.suspenseAccountCode ?? undefined,
    }, batch.id);
    staging.sourceChecksum = batch.sourceChecksum ?? staging.sourceChecksum;
    const errors = staging.errorIssues.length;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.openingBalanceBatch.updateMany({
        where: { id: batch.id, companyId: scope.companyId, branchId: scope.branchId, status: batch.status, updatedAt: batch.updatedAt },
        data: {
          status: errors ? OpeningBalanceStatus.FAILED : OpeningBalanceStatus.VALIDATED,
          totalDebit: staging.totalDebit,
          totalCredit: staging.totalCredit,
          rowCount: staging.rows.length,
          validRowCount: staging.rows.length - errors,
          errorRowCount: errors,
          approvedBy: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({ code: 'OPENING_BATCH_STATE_CHANGED', message: 'Status batch berubah; muat ulang sebelum validasi ulang.' });
      }
      await tx.openingBalanceRow.deleteMany({ where: { batchId: batch.id } });
      await tx.openingBalanceRow.createMany({ data: staging.rows.map((row) => ({ ...row.data, batchId: batch.id })) });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId, userId: user.sub, action: 'OPENING_BALANCE_BATCH_REVALIDATED', entityType: 'OpeningBalanceBatch', entityId: batch.id,
          payload: { branchId: scope.branchId, reason: dto.reason?.trim() || null, rowCount: staging.rows.length, errorRowCount: errors },
        },
      });
    });
    return this.get(user, batch.id);
  }

  async submit(user: AuthUser, id: string) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (batch.status !== OpeningBalanceStatus.VALIDATED || batch.errorRowCount !== 0 || batch.rowCount === 0 || batch.validRowCount !== batch.rowCount) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_SUBMITTABLE', message: 'Hanya batch VALIDATED tanpa error yang dapat diajukan approval.' });
    }
    await this.transition(user, scope, batch.id, [OpeningBalanceStatus.VALIDATED], {
      status: OpeningBalanceStatus.WAITING_APPROVAL,
    }, 'OPENING_BALANCE_BATCH_SUBMITTED');
    return this.get(user, batch.id);
  }

  async approve(user: AuthUser, id: string, note?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (batch.status !== OpeningBalanceStatus.WAITING_APPROVAL) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_APPROVABLE', message: 'Hanya batch WAITING_APPROVAL yang dapat di-approve.' });
    }
    if (batch.createdBy === user.sub) {
      throw new ForbiddenException({ code: 'OPENING_MAKER_CHECKER_REQUIRED', message: 'Pembuat batch tidak boleh menjadi approver.' });
    }
    await this.transition(user, scope, batch.id, [OpeningBalanceStatus.WAITING_APPROVAL], {
      status: OpeningBalanceStatus.APPROVED,
      approvedBy: user.sub,
    }, 'OPENING_BALANCE_BATCH_APPROVED', note?.trim());
    return this.get(user, batch.id);
  }

  async cancel(user: AuthUser, id: string, dto: CancelOpeningBalanceBatchDto) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (LOCKED_STATUSES.includes(batch.status)) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_CANCELLABLE', message: `Batch berstatus ${batch.status} tidak dapat dibatalkan.` });
    }
    await this.transition(user, scope, batch.id, [batch.status], { status: OpeningBalanceStatus.CANCELLED }, 'OPENING_BALANCE_BATCH_CANCELLED', dto.reason.trim());
    return this.get(user, batch.id);
  }

  async post(user: AuthUser, id: string) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (batch.status === OpeningBalanceStatus.POSTED) return this.get(user, id);
    if (batch.status !== OpeningBalanceStatus.APPROVED) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_POSTABLE', message: 'Hanya batch APPROVED yang dapat diposting.' });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertFeatureEnabled(tx, scope);
        const current = await tx.openingBalanceBatch.findFirst({
          where: { id, companyId: scope.companyId, branchId: scope.branchId },
          include: { rows: { orderBy: { rowNumber: 'asc' } } },
        });
        if (!current) throw new NotFoundException({ code: 'OPENING_BATCH_NOT_FOUND', message: 'Batch saldo awal tidak ditemukan.' });
        if (current.status === OpeningBalanceStatus.POSTED) return;
        if (current.status !== OpeningBalanceStatus.APPROVED) {
          throw new ConflictException({ code: 'OPENING_BATCH_STATE_CHANGED', message: 'Status batch berubah; muat ulang lalu coba lagi.' });
        }
        const rows = current.rows.filter((row) => row.status === 'VALID');
        if (!rows.length || rows.length !== current.rowCount || current.errorRowCount !== 0) {
          throw new ConflictException({ code: 'OPENING_BATCH_ROWS_INVALID', message: 'Batch tidak memiliki baris valid yang lengkap untuk diposting.' });
        }
        const totalDebit = rows.reduce((total, row) => total.add(row.debit), new Prisma.Decimal(0));
        const totalCredit = rows.reduce((total, row) => total.add(row.credit), new Prisma.Decimal(0));
        if ((current.type === OpeningBalanceType.GL && !totalDebit.equals(totalCredit))
          || !totalDebit.equals(current.totalDebit) || !totalCredit.equals(current.totalCredit)) {
          throw new ConflictException({ code: 'OPENING_BATCH_TOTALS_MISMATCH', message: 'Total batch tidak seimbang atau tidak sesuai baris; validasi ulang batch.' });
        }

        let lines: { accountCode: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }[];
        let ledger: { kind: OpeningLedgerKind; documentCount: number } | undefined;
        if (current.type === OpeningBalanceType.GL) {
          const codes = [...new Set(rows.map((row) => row.accountCode).filter((code): code is string => Boolean(code)))];
          const accounts = await tx.account.findMany({
            where: { branchId: scope.branchId, code: { in: codes } },
            select: { code: true, type: true, isActive: true },
          });
          const accountMap = new Map(accounts.map((account) => [account.code, account]));
          const missing = codes.filter((code) => !accountMap.has(code));
          if (missing.length) throw new BadRequestException({ code: 'OPENING_GL_ACCOUNT_INVALID', message: `Akun GL tidak ditemukan: ${missing.join(', ')}.` });
          const invalid = accounts.filter((account) => !account.isActive || !BALANCE_SHEET_TYPES.includes(account.type)).map((account) => account.code);
          if (invalid.length) throw new BadRequestException({ code: 'OPENING_GL_ACCOUNT_INVALID', message: `Akun GL tidak aktif atau bukan akun neraca: ${invalid.join(', ')}.` });

          const conflict = await tx.openingBalanceBatch.findFirst({
            where: {
              companyId: scope.companyId,
              branchId: scope.branchId,
              cutoverDate: current.cutoverDate,
              type: { in: [OpeningBalanceType.STOCK, OpeningBalanceType.AR, OpeningBalanceType.AP] },
              status: { not: OpeningBalanceStatus.CANCELLED },
              controlAccountCode: { in: codes },
            },
            select: { id: true, type: true, controlAccountCode: true },
          });
          if (conflict) {
            throw new BadRequestException({
              code: 'OPENING_GL_CONTROL_ACCOUNT_CONFLICT',
              message: `Akun ${conflict.controlAccountCode} sudah dicakup batch ${conflict.type} ${conflict.id}; GL hanya untuk akun residual.`,
            });
          }
          lines = rows.map((row) => ({
            accountCode: row.accountCode!,
            debit: row.debit,
            credit: row.credit,
            description: row.description ?? undefined,
          }));
        } else {
          const control = current.controlAccountCode;
          if (!control) throw new BadRequestException({ code: 'OPENING_BATCH_CONTROL_ACCOUNT_REQUIRED', message: `Akun kontrol ${current.type} wajib diisi.` });
          const offset = current.offsetAccountCode ?? current.suspenseAccountCode;
          if (!offset) throw new BadRequestException({ code: 'OPENING_BATCH_OFFSET_ACCOUNT_REQUIRED', message: `Akun lawan atau suspense ${current.type} wajib diisi untuk posting.` });
          if (offset === control) throw new BadRequestException({ code: 'OPENING_BATCH_ACCOUNT_DUPLICATE', message: 'Akun kontrol dan akun lawan harus berbeda.' });
          const accounts = await tx.account.findMany({
            where: { branchId: scope.branchId, code: { in: [control, offset] } },
            select: { code: true, type: true, isActive: true },
          });
          const accountMap = new Map(accounts.map((account) => [account.code, account]));
          const controlAccount = accountMap.get(control);
          const expectedControl: AccountType = current.type === OpeningBalanceType.AP ? AccountType.LIABILITY : AccountType.ASSET;
          if (!controlAccount || !controlAccount.isActive || controlAccount.type !== expectedControl) {
            throw new BadRequestException({ code: 'OPENING_BATCH_CONTROL_ACCOUNT_INVALID', message: `Akun kontrol ${current.type} harus aktif dan bertipe ${expectedControl}.` });
          }
          const offsetAccount = accountMap.get(offset);
          if (!offsetAccount || !offsetAccount.isActive || !BALANCE_SHEET_TYPES.includes(offsetAccount.type)) {
            throw new BadRequestException({ code: 'OPENING_BATCH_ACCOUNT_INVALID', message: 'Akun lawan tidak ditemukan, tidak aktif, atau bukan akun neraca.' });
          }
          const mismatched = rows.filter((row) => row.accountCode && row.accountCode !== control);
          if (mismatched.length) {
            throw new BadRequestException({ code: 'OPENING_LEDGER_ACCOUNT_MISMATCH', message: `Akun baris ${current.type} harus sama dengan akun kontrol batch.` });
          }
          const outstanding = rows.reduce((total, row) => total.add(row.debit).add(row.credit), new Prisma.Decimal(0));
          lines = current.type === OpeningBalanceType.AR
            ? [
                { accountCode: control, debit: outstanding, credit: new Prisma.Decimal(0) },
                { accountCode: offset, debit: new Prisma.Decimal(0), credit: outstanding },
              ]
            : [
                { accountCode: offset, debit: outstanding, credit: new Prisma.Decimal(0) },
                { accountCode: control, debit: new Prisma.Decimal(0), credit: outstanding },
              ];
          if (current.type === OpeningBalanceType.AR || current.type === OpeningBalanceType.AP) {
            ledger = {
              kind: current.type === OpeningBalanceType.AR ? OpeningLedgerKind.AR : OpeningLedgerKind.AP,
              documentCount: rows.length,
            };
          }
        }

        const claimed = await tx.openingBalanceBatch.updateMany({
          where: {
            id: current.id,
            companyId: scope.companyId,
            branchId: scope.branchId,
            status: OpeningBalanceStatus.APPROVED,
            updatedAt: current.updatedAt,
          },
          data: { status: OpeningBalanceStatus.POSTING },
        });
        if (claimed.count !== 1) {
          throw new ConflictException({ code: 'OPENING_BATCH_STATE_CHANGED', message: 'Status batch berubah; muat ulang lalu coba lagi.' });
        }

        const event = await this.accounting.postSystemJournal(tx, {
          companyId: scope.companyId,
          branchId: scope.branchId,
          eventType: 'OPENING_BALANCE',
          sourceType: 'OPENING_BALANCE_BATCH',
          sourceId: current.id,
          idempotencyKey: `opening-${current.type.toLowerCase()}:${current.id}`,
          businessDate: current.cutoverDate,
          currency: 'IDR',
          description: `Opening ${current.type} batch ${current.id}`,
          actorId: user.sub,
          context: { openingBatchId: current.id, openingType: current.type },
          lines,
        });

        if (ledger) {
          await tx.openingLedgerDocument.createMany({
            data: rows.map((row) => ({
              companyId: scope.companyId,
              branchId: scope.branchId,
              rowId: row.id,
              kind: ledger.kind,
              customerId: row.customerId,
              supplierId: row.supplierId,
              documentNumber: row.documentNumber!,
              documentDate: row.documentDate!,
              dueDate: row.dueDate!,
              subtotal: row.subtotal,
              taxCodeId: row.taxCodeId,
              taxCodeVersion: row.taxCodeVersion,
              taxRateSnapshot: row.taxRateSnapshot,
              taxAmount: row.taxAmount,
              total: row.total,
              paidAmount: row.paidAmount,
              settledAmount: new Prisma.Decimal(0),
              outstandingAmount: row.total.sub(row.paidAmount),
              controlAccountCode: current.controlAccountCode!,
              status: OpeningLedgerStatus.OPEN,
            })),
          });
        }

        if (current.type === OpeningBalanceType.STOCK) {
          const costingEnabled = await this.costing.isEnabled(tx, scope.companyId, scope.branchId);
          for (const row of rows) {
            const quantity = row.quantity ?? 0;
            if (!Number.isInteger(quantity) || quantity <= 0) {
              throw new BadRequestException({ code: 'OPENING_STOCK_QUANTITY_INVALID', message: `Baris ${row.rowNumber} memiliki quantity tidak valid.` });
            }
            const unitCost = new Prisma.Decimal(row.unitCost ?? 0);
            if (unitCost.lessThan(0)) throw new BadRequestException({ code: 'OPENING_STOCK_COST_INVALID', message: `Baris ${row.rowNumber} memiliki unitCost tidak valid.` });
            const warehouse = await tx.warehouse.findFirst({ where: { id: row.warehouseId!, branchId: scope.branchId, branch: { companyId: scope.companyId } }, select: { id: true } });
            if (!warehouse) throw new BadRequestException({ code: 'OPENING_STOCK_WAREHOUSE_INVALID', message: `Gudang baris ${row.rowNumber} tidak valid.` });
            const product = await tx.product.findFirst({ where: { id: row.productId!, companyId: scope.companyId }, select: { id: true, name: true, trackSerial: true } });
            if (!product) throw new BadRequestException({ code: 'OPENING_STOCK_PRODUCT_NOT_FOUND', message: `Produk baris ${row.rowNumber} tidak ditemukan.` });
            if (product.trackSerial) throw new BadRequestException({ code: 'OPENING_STOCK_SERIAL_UNSUPPORTED', message: `Produk ${product.name} memakai serial dan belum didukung pada saldo awal stok.` });

            const location = row.locationCode
              ? await tx.warehouseLocation.findFirst({ where: { warehouseId: row.warehouseId!, code: row.locationCode } })
              : null;
            if (row.locationCode && !location) {
              throw new BadRequestException({ code: 'OPENING_STOCK_LOCATION_INVALID', message: `Lokasi ${row.locationCode} tidak ditemukan.` });
            }
            const locationStock = await depositLocationStock(tx, {
              warehouseId: row.warehouseId!,
              productId: row.productId!,
              quantity,
              locationId: location?.id,
            });
            const inventory = await tx.inventory.upsert({
              where: { warehouseId_productId: { warehouseId: row.warehouseId!, productId: row.productId! } },
              create: { warehouseId: row.warehouseId!, productId: row.productId!, quantity, available: quantity },
              update: { quantity: { increment: quantity }, available: { increment: quantity } },
            });
            const movement = await tx.inventoryMovement.create({ data: {
              warehouseId: row.warehouseId!,
              productId: row.productId!,
              locationId: locationStock.locationId,
              type: 'OPENING_STOCK',
              quantity,
              balanceAfter: inventory.quantity,
              referenceType: 'OpeningBalanceBatch',
              referenceId: current.id,
              occurredAt: current.cutoverDate,
              notes: row.description ?? undefined,
            } });
            if (row.batchNumber) {
              const existingBatch = await tx.inventoryBatch.findUnique({
                where: { warehouseId_productId_batchNumber: { warehouseId: row.warehouseId!, productId: row.productId!, batchNumber: row.batchNumber } },
              });
              if (existingBatch?.expiryDate && row.expiryDate && existingBatch.expiryDate.getTime() !== row.expiryDate.getTime()) {
                throw new BadRequestException({ code: 'OPENING_STOCK_BATCH_EXPIRY_MISMATCH', message: `Tanggal kedaluwarsa batch ${row.batchNumber} berbeda.` });
              }
              await tx.inventoryBatch.upsert({
                where: { warehouseId_productId_batchNumber: { warehouseId: row.warehouseId!, productId: row.productId!, batchNumber: row.batchNumber } },
                create: { warehouseId: row.warehouseId!, productId: row.productId!, batchNumber: row.batchNumber, expiryDate: row.expiryDate ?? undefined, quantity, metadata: { openingBalanceBatchId: current.id } },
                update: { quantity: { increment: quantity }, ...(existingBatch?.expiryDate ? {} : row.expiryDate ? { expiryDate: row.expiryDate } : {}) },
              });
            }
            if (costingEnabled) {
              const totalValue = unitCost.mul(quantity);
              await this.costing.recordReceipt(tx, {
                companyId: scope.companyId,
                branchId: scope.branchId,
                warehouseId: row.warehouseId!,
                productId: row.productId!,
                batchKey: row.batchNumber ?? '',
                quantity,
                totalValue,
                occurredAt: current.cutoverDate,
                movementId: movement.id,
                sourceType: 'OpeningBalanceBatch',
                sourceId: current.id,
                sourceLineKey: row.id,
                operationKey: `opening-stock-cost:${current.id}:${row.id}:v1`,
                payloadHash: createHash('sha256').update(JSON.stringify({ batchId: current.id, rowId: row.id, quantity, unitCost: unitCost.toFixed(6), batchKey: row.batchNumber ?? '', occurredAt: current.cutoverDate.toISOString() })).digest('hex'),
                createdById: user.sub,
              });
            }
          }
        }

        const postedAt = new Date();
        await tx.openingBalanceRow.updateMany({ where: { batchId: current.id }, data: { status: 'POSTED', postedAt } });
        await tx.openingBalanceBatch.update({
          where: { id: current.id },
          data: { status: OpeningBalanceStatus.POSTED, postedAt },
        });
        await tx.auditLog.create({
          data: {
            companyId: scope.companyId,
            userId: user.sub,
            action: 'OPENING_BALANCE_BATCH_POSTED',
            entityType: 'OpeningBalanceBatch',
            entityId: current.id,
            payload: {
              branchId: scope.branchId,
              type: current.type,
              accountingEventId: event.id,
              journalEntryId: event.journalEntryId,
              totalDebit: totalDebit.toFixed(2),
              totalCredit: totalCredit.toFixed(2),
              ledgerDocumentCount: ledger?.documentCount ?? 0,
            },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'OPENING_LEDGER_DOCUMENT_DUPLICATE', message: 'Nomor dokumen saldo awal sudah dipakai batch lain.' });
      }
      throw error;
    }

    return this.get(user, id);
  }

  private normalizeReverseInput(input?: string | ReverseOpeningBalanceBatchDto | Record<string, unknown>): { reason: string; businessDate?: string; operationKey?: string; idempotencyKey?: string } {
    if (typeof input === 'string') return { reason: input };
    const source = (input ?? {}) as Record<string, unknown>;
    return {
      reason: String(source.reason ?? source.note ?? 'Pembalikan saldo awal GL').trim() || 'Pembalikan saldo awal GL',
      businessDate: source.businessDate ? String(source.businessDate) : (source.reversalDate ? String(source.reversalDate) : undefined),
      operationKey: source.operationKey ? String(source.operationKey) : undefined,
      idempotencyKey: source.idempotencyKey ? String(source.idempotencyKey) : undefined,
    };
  }

  async reverse(user: AuthUser, id: string, input?: string | ReverseOpeningBalanceBatchDto | Record<string, unknown>) {
    return this.reverseBatch(user, id, input);
  }

  async reverseBatch(user: AuthUser, id: string, input?: string | ReverseOpeningBalanceBatchDto | Record<string, unknown>) {
    return this.reversePosting(user, id, input);
  }

  async reversePosting(user: AuthUser, id: string, input?: string | ReverseOpeningBalanceBatchDto | Record<string, unknown>) {
    return this.reverseGl(user, id, input);
  }

  async reverseGl(user: AuthUser, id: string, input?: string | ReverseOpeningBalanceBatchDto | Record<string, unknown>) {
    const scope = this.requireTenantScope(user);
    const dto = this.normalizeReverseInput(input);
    const batch = await this.tenantBatch(this.prisma, scope, id);
    if (!([OpeningBalanceType.GL, OpeningBalanceType.AR, OpeningBalanceType.AP, OpeningBalanceType.STOCK] as string[]).includes(batch.type)) {
      throw new BadRequestException({ code: 'OPENING_REVERSE_TYPE_NOT_READY', message: 'Hanya batch GL/AR/AP/STOCK POSTED yang dapat dibalik.' });
    }
    if (batch.status !== OpeningBalanceStatus.POSTED) {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_REVERSIBLE', message: `Batch berstatus ${batch.status} tidak dapat dibalik.` });
    }

    const originalEvent = await this.prisma.accountingEvent.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, sourceType: 'OPENING_BALANCE_BATCH', sourceId: id },
      include: { postings: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!originalEvent) {
      throw new NotFoundException({ code: 'OPENING_BATCH_EVENT_NOT_FOUND', message: 'Event jurnal saldo awal tidak ditemukan.' });
    }
    const alreadyReversed = originalEvent.status === 'REVERSED'
      || originalEvent.postings.some((posting) => Boolean(posting.reversedAt));
    if (alreadyReversed) {
      return this.get(user, id);
    }
    if (originalEvent.status !== 'POSTED') {
      throw new BadRequestException({ code: 'OPENING_BATCH_NOT_REVERSIBLE', message: `Event jurnal berstatus ${originalEvent.status} tidak dapat dibalik.` });
    }

    const idempotencyKey = (dto.idempotencyKey || dto.operationKey || `opening-gl-reversal:${id}`).trim();
    const reason = dto.reason;
    const businessDate = dto.businessDate ? new Date(dto.businessDate) : batch.cutoverDate;
    if (Number.isNaN(businessDate.getTime())) {
      throw new BadRequestException({ code: 'OPENING_REVERSAL_DATE_INVALID', message: 'Tanggal pembalikan tidak valid.' });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.openingBalanceBatch.findFirst({
          where: { id, companyId: scope.companyId, branchId: scope.branchId },
          include: { rows: { orderBy: { rowNumber: 'asc' } } },
        });
        if (!current || current.status !== OpeningBalanceStatus.POSTED) {
          throw new ConflictException({ code: 'OPENING_BATCH_STATE_CHANGED', message: 'Status batch berubah; muat ulang lalu coba lagi.' });
        }
        const event = await tx.accountingEvent.findFirst({
          where: { companyId: scope.companyId, branchId: scope.branchId, sourceType: 'OPENING_BALANCE_BATCH', sourceId: id },
          include: { postings: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!event || event.status !== 'POSTED' || event.postings.some((posting) => Boolean(posting.reversedAt))) {
          return;
        }
        await this.accounting.postReversal(tx, {
          companyId: scope.companyId,
          branchId: scope.branchId,
          originalEventId: event.id,
          idempotencyKey,
          businessDate,
          reason,
          sourceType: 'OPENING_BALANCE_BATCH_REVERSAL',
          sourceId: id,
          actorId: user.sub,
        });

        if (current.type === OpeningBalanceType.STOCK) {
          const costingEnabled = await this.costing.isEnabled(tx, scope.companyId, scope.branchId);
          for (const row of (current.rows ?? [])) {
            const quantity = row.quantity ?? 0;
            if (!Number.isInteger(quantity) || quantity <= 0) continue;
            const warehouseId = row.warehouseId!;
            const productId = row.productId!;
            const inventory = await tx.inventory.findFirst({ where: { warehouseId, productId } });
            if (!inventory || inventory.quantity < quantity) {
              throw new ConflictException({ code: 'OPENING_STOCK_REVERSAL_INSUFFICIENT', message: `Stok opening baris ${row.rowNumber} sudah terpakai; reversal tidak dapat dilakukan.` });
            }
            await adjustLocationStock(tx, { warehouseId, productId, difference: -quantity });
            await tx.inventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: quantity }, available: { decrement: quantity } } });
            await tx.inventoryMovement.create({ data: {
              warehouseId,
              productId,
              locationId: null,
              type: 'ADJUSTMENT_OUT',
              quantity: -quantity,
              balanceAfter: inventory.quantity - quantity,
              referenceType: 'OpeningBalanceBatch',
              referenceId: current.id,
              occurredAt: businessDate,
              notes: row.description ?? undefined,
            } });
            if (row.batchNumber) {
              const batch = await tx.inventoryBatch.findUnique({ where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: row.batchNumber } } });
              if (batch) {
                const nextQty = batch.quantity - quantity;
                if (nextQty <= 0) await tx.inventoryBatch.delete({ where: { id: batch.id } });
                else await tx.inventoryBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: quantity } } });
              }
            }
            if (costingEnabled) {
              await this.costing.recordReceiptReversal(tx, {
                companyId: scope.companyId,
                branchId: scope.branchId,
                warehouseId,
                productId,
                batchKey: row.batchNumber ?? '',
                occurredAt: businessDate,
                sourceType: 'OPENING_BALANCE_BATCH',
                sourceId: current.id,
                sourceLineKey: row.id,
                operationKey: `opening-stock-cost-reversal:${current.id}:${row.id}:v1`,
                payloadHash: createHash('sha256').update(JSON.stringify({ batchId: current.id, rowId: row.id })).digest('hex'),
                createdById: user.sub,
              });
            }
          }
        }

        if (current.type === OpeningBalanceType.AR || current.type === OpeningBalanceType.AP) {
          const rowIds = (current.rows ?? []).map((row) => row.id);
          const documents = await tx.openingLedgerDocument.findMany({
            where: { companyId: scope.companyId, branchId: scope.branchId, rowId: { in: rowIds } },
            include: { settlements: true },
          });

          const settled = documents.filter((doc) => doc.settledAmount.greaterThan(0) || doc.settlements.length > 0);
          if (settled.length) {
            throw new ConflictException({
              code: 'OPENING_LEDGER_SETTLEMENT_EXISTS',
              message: `Dokumen ${settled.map((d) => d.documentNumber).join(', ')} sudah memiliki settlement dan tidak dapat dibalik.`,
            });
          }

          await tx.openingLedgerDocument.updateMany({
            where: { id: { in: documents.map((d) => d.id) } },
            data: { status: OpeningLedgerStatus.WRITTEN_OFF, outstandingAmount: new Prisma.Decimal(0) },
          });
        }

        await tx.auditLog.create({
          data: {
            companyId: scope.companyId,
            userId: user.sub,
            action: 'OPENING_BALANCE_BATCH_REVERSED',
            entityType: 'OpeningBalanceBatch',
            entityId: id,
            payload: {
              branchId: scope.branchId,
              type: current.type,
              originalAccountingEventId: event.id,
              idempotencyKey,
              reason,
            },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'OPENING_REVERSAL_DUPLICATE', message: 'Pembalikan saldo awal sudah diproses.' });
      }
      throw error;
    }

    return this.get(user, id);
  }



  private async runSettlement(user: AuthUser, input: {
    documentId: string;
    financeTransactionId: string;
    amount: string | number | Prisma.Decimal;
    operationKey: string;
  }) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException({ code: 'OPENING_SETTLEMENT_AMOUNT_INVALID', message: 'Jumlah settlement harus lebih besar dari nol.' });

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.openingLedgerDocument.findFirst({ where: { id: input.documentId, companyId: scope.companyId, branchId: scope.branchId } });
      if (!document) throw new NotFoundException({ code: 'OPENING_LEDGER_DOCUMENT_NOT_FOUND', message: 'Dokumen ledger saldo awal tidak ditemukan.' });
      const finance = await tx.operationalFinanceTransaction.findFirst({ where: { id: input.financeTransactionId, companyId: scope.companyId, branchId: scope.branchId } });
      if (!finance) throw new NotFoundException({ code: 'FINANCE_TRANSACTION_NOT_FOUND', message: 'Transaksi keuangan tidak ditemukan.' });
      if (finance.status !== 'POSTED') throw new BadRequestException({ code: 'FINANCE_TRANSACTION_NOT_POSTED', message: 'Transaksi keuangan harus POSTED untuk settlement.' });
      const existing = await tx.openingLedgerSettlement.findFirst({ where: { companyId: scope.companyId, branchId: scope.branchId, operationKey: input.operationKey } });
      if (existing) {
        if (existing.documentId !== document.id || existing.financeTransactionId !== finance.id) {
          throw new ConflictException({ code: 'OPENING_SETTLEMENT_OPERATION_KEY_CONFLICT', message: 'Operation key settlement sudah dipakai dokumen/transaksi lain.' });
        }
        return existing;
      }

      const duplicatePair = await tx.openingLedgerSettlement.findFirst({ where: { documentId: document.id, financeTransactionId: finance.id } });
      if (duplicatePair) return duplicatePair;

      if (amount.greaterThan(document.outstandingAmount)) {
        throw new BadRequestException({ code: 'OPENING_SETTLEMENT_AMOUNT_EXCEEDS_OUTSTANDING', message: 'Jumlah settlement melebihi outstanding dokumen.' });
      }

      const settlement = await tx.openingLedgerSettlement.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          documentId: document.id,
          financeTransactionId: finance.id,
          amount,
          operationKey: input.operationKey,
          status: 'POSTED',
        },
      });

      const outstanding = document.outstandingAmount.sub(amount);
      await tx.openingLedgerDocument.update({
        where: { id: document.id },
        data: {
          settledAmount: document.settledAmount.add(amount),
          outstandingAmount: outstanding,
          status: outstanding.lessThanOrEqualTo(0) ? OpeningLedgerStatus.SETTLED : OpeningLedgerStatus.PARTIALLY_SETTLED,
        },
      });
      return settlement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async settle(user: AuthUser, input: any) {
    return this.runSettlement(user, input);
  }

  async settleOpeningLedger(user: AuthUser, input: any) {
    return this.runSettlement(user, input);
  }

  async settleDocument(user: AuthUser, input: any) {
    return this.runSettlement(user, input);
  }

  async settleOpening(user: AuthUser, input: any) {
    return this.runSettlement(user, input);
  }

  async applySettlement(user: AuthUser, input: any) {
    return this.runSettlement(user, input);
  }


  private async runYearEndClose(user: AuthUser, input: any) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const fiscalYear = Number(input?.fiscalYear);
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new BadRequestException({ code: 'YEAR_END_FISCAL_YEAR_INVALID', message: 'Tahun fiskal tidak valid.' });
    }
    const retainedEarningsAccountCode = String(input?.retainedEarningsAccountCode ?? '').trim().toUpperCase();
    const incomeSummaryAccountCode = String(input?.incomeSummaryAccountCode ?? '').trim().toUpperCase();
    const operationKey = String(input?.operationKey ?? '').trim();
    if (!retainedEarningsAccountCode || !incomeSummaryAccountCode || operationKey.length < 8) {
      throw new BadRequestException({ code: 'YEAR_END_INPUT_INVALID', message: 'Akun laba ditahan, income summary, dan operation key minimal 8 karakter wajib diisi.' });
    }
    if (retainedEarningsAccountCode === incomeSummaryAccountCode) {
      throw new BadRequestException({ code: 'YEAR_END_ACCOUNT_DUPLICATE', message: 'Akun laba ditahan dan income summary harus berbeda.' });
    }

    const gate = await this.runCutoverGate(user);
    if (!gate.ready) {
      throw new BadRequestException({ code: 'YEAR_END_CUTOVER_NOT_READY', message: 'Cutover gate harus lulus sebelum tutup tahun.' });
    }

    const existing = await this.prisma.yearEndCloseRun.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, fiscalYear, operationKey },
    });
    if (existing?.status === 'POSTED') return existing;

    const yearStart = new Date(Date.UTC(fiscalYear, 0, 1));
    const yearEnd = new Date(Date.UTC(fiscalYear, 11, 31, 23, 59, 59, 999));

    return this.prisma.$transaction(async (tx) => {
      const accounts = await tx.account.findMany({
        where: { branchId: scope.branchId, code: { in: [retainedEarningsAccountCode, incomeSummaryAccountCode] }, isActive: true },
        select: { id: true, code: true, type: true },
      });
      const accountMap = new Map(accounts.map((account) => [account.code, account]));
      const retained = accountMap.get(retainedEarningsAccountCode);
      const incomeSummary = accountMap.get(incomeSummaryAccountCode);
      if (!retained || retained.type !== 'EQUITY') throw new BadRequestException({ code: 'YEAR_END_RETAINED_ACCOUNT_INVALID', message: 'Akun laba ditahan harus aktif dan bertipe EQUITY.' });
      if (!incomeSummary || !['EQUITY', 'REVENUE', 'EXPENSE'].includes(incomeSummary.type)) throw new BadRequestException({ code: 'YEAR_END_INCOME_SUMMARY_INVALID', message: 'Akun income summary tidak valid.' });

      const reAccounts = await tx.account.findMany({
        where: { branchId: scope.branchId, type: { in: ['REVENUE', 'EXPENSE'] }, isActive: true },
        select: { id: true, code: true, type: true },
      });
      const reIds = reAccounts.map((account) => account.id);
      const journalLines = reIds.length
        ? await tx.journalLine.findMany({
            where: { accountId: { in: reIds }, journalEntry: { date: { gte: yearStart, lte: yearEnd } } },
            include: { account: { select: { id: true, code: true, type: true } } },
          })
        : [];

      const balanceByAccount = new Map<string, Prisma.Decimal>();
      for (const account of reAccounts) balanceByAccount.set(account.code, new Prisma.Decimal(0));
      for (const line of journalLines) {
        const code = line.account.code;
        const current = balanceByAccount.get(code) ?? new Prisma.Decimal(0);
        balanceByAccount.set(code, current.add(line.debit).sub(line.credit));
      }

      const lines: { accountCode: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description?: string }[] = [];
      let totalRevenue = new Prisma.Decimal(0);
      let totalExpense = new Prisma.Decimal(0);
      for (const account of reAccounts) {
        const net = balanceByAccount.get(account.code) ?? new Prisma.Decimal(0);
        if (net.isZero()) continue;
        if (net.greaterThan(0)) {
          // debit balance (expense): credit account, debit income summary
          lines.push({ accountCode: account.code, debit: new Prisma.Decimal(0), credit: net, description: `Tutup ${account.code}` });
          lines.push({ accountCode: incomeSummaryAccountCode, debit: net, credit: new Prisma.Decimal(0), description: `Tutup ${account.code}` });
          if (account.type === 'EXPENSE') totalExpense = totalExpense.add(net);
        } else {
          const abs = net.abs();
          lines.push({ accountCode: account.code, debit: abs, credit: new Prisma.Decimal(0), description: `Tutup ${account.code}` });
          lines.push({ accountCode: incomeSummaryAccountCode, debit: new Prisma.Decimal(0), credit: abs, description: `Tutup ${account.code}` });
          if (account.type === 'REVENUE') totalRevenue = totalRevenue.add(abs);
        }
      }

      const incomeSummaryBalance = totalExpense.sub(totalRevenue); // debit - credit
      if (!incomeSummaryBalance.isZero()) {
        if (incomeSummaryBalance.greaterThan(0)) {
          // net loss: credit income summary, debit retained earnings
          lines.push({ accountCode: incomeSummaryAccountCode, debit: new Prisma.Decimal(0), credit: incomeSummaryBalance, description: 'Tutup income summary' });
          lines.push({ accountCode: retainedEarningsAccountCode, debit: incomeSummaryBalance, credit: new Prisma.Decimal(0), description: 'Tutup income summary' });
        } else {
          const amount = incomeSummaryBalance.abs();
          lines.push({ accountCode: incomeSummaryAccountCode, debit: amount, credit: new Prisma.Decimal(0), description: 'Tutup income summary' });
          lines.push({ accountCode: retainedEarningsAccountCode, debit: new Prisma.Decimal(0), credit: amount, description: 'Tutup income summary' });
        }
      }

      const totalDebit = lines.reduce((total, line) => total.add(line.debit), new Prisma.Decimal(0));
      const totalCredit = lines.reduce((total, line) => total.add(line.credit), new Prisma.Decimal(0));
      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException({ code: 'YEAR_END_JOURNAL_UNBALANCED', message: 'Jurnal tutup tahun tidak seimbang.' });
      }

      const netIncome = totalRevenue.sub(totalExpense);
      const run = existing
        ? await tx.yearEndCloseRun.update({
            where: { id: existing.id },
            data: {
              status: 'POSTING',
              retainedEarningsAccountCode,
              incomeSummaryAccountCode,
              netIncome,
              totalDebit,
              totalCredit,
              previewJson: { revenue: totalRevenue.toFixed(2), expense: totalExpense.toFixed(2), netIncome: netIncome.toFixed(2), lineCount: lines.length },
            },
          })
        : await tx.yearEndCloseRun.create({
            data: {
              companyId: scope.companyId,
              branchId: scope.branchId,
              fiscalYear,
              status: 'POSTING',
              retainedEarningsAccountCode,
              incomeSummaryAccountCode,
              netIncome,
              totalDebit,
              totalCredit,
              previewJson: { revenue: totalRevenue.toFixed(2), expense: totalExpense.toFixed(2), netIncome: netIncome.toFixed(2), lineCount: lines.length },
              operationKey,
              createdBy: user.sub,
            },
          });

      await tx.yearEndCloseLine.deleteMany({ where: { runId: run.id } });
      if (lines.length) {
        await tx.yearEndCloseLine.createMany({
          data: lines.map((line) => ({
            runId: run.id,
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            lineType: line.accountCode === retainedEarningsAccountCode ? 'RETAINED_EARNINGS' : (line.accountCode === incomeSummaryAccountCode ? 'INCOME_SUMMARY' : 'CLOSING'),
            description: line.description ?? null,
          })),
        });
      }

      let journalEntryId: string | null = null;
      if (lines.length) {
        const event = await this.accounting.postSystemJournal(tx, {
          companyId: scope.companyId,
          branchId: scope.branchId,
          eventType: 'YEAR_END_CLOSE',
          sourceType: 'YEAR_END_CLOSE_RUN',
          sourceId: run.id,
          idempotencyKey: `year-end-close:${run.id}`,
          businessDate: yearEnd,
          currency: 'IDR',
          description: `Year end close FY${fiscalYear}`,
          actorId: user.sub,
          context: { yearEndCloseRunId: run.id, fiscalYear },
          lines: lines.map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit, description: line.description })),
        });
        journalEntryId = event.journalEntryId ?? null;
      }

      const bsAccounts = await tx.account.findMany({
        where: { branchId: scope.branchId, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }, isActive: true },
        select: { id: true, code: true },
      });
      const bsIds = bsAccounts.map((account) => account.id);
      const bsLines = bsIds.length
        ? await tx.journalLine.findMany({ where: { accountId: { in: bsIds }, journalEntry: { date: { lte: yearEnd } } } })
        : [];
      const bsBalance = new Map<string, Prisma.Decimal>();
      for (const account of bsAccounts) bsBalance.set(account.code, new Prisma.Decimal(0));
      for (const line of bsLines) {
        const account = bsAccounts.find((item) => item.id === line.accountId);
        if (!account) continue;
        const current = bsBalance.get(account.code) ?? new Prisma.Decimal(0);
        bsBalance.set(account.code, current.add(line.debit).sub(line.credit));
      }
      const snapshotRows = [...bsBalance.entries()]
        .map(([code, net], index) => ({
          rowNumber: index + 1,
          status: 'VALID',
          payloadHash: createHash('sha256').update(`year-end-snapshot:${run.id}:${code}:${net.toFixed(2)}`).digest('hex'),
          accountCode: code,
          debit: net.greaterThan(0) ? net : new Prisma.Decimal(0),
          credit: net.lessThan(0) ? net.abs() : new Prisma.Decimal(0),
          description: `Snapshot opening FY${fiscalYear + 1}`,
        }))
        .filter((row) => !row.debit.isZero() || !row.credit.isZero());
      const snapshotTotalDebit = snapshotRows.reduce((total, row) => total.add(row.debit), new Prisma.Decimal(0));
      const snapshotTotalCredit = snapshotRows.reduce((total, row) => total.add(row.credit), new Prisma.Decimal(0));
      if (snapshotRows.length && snapshotTotalDebit.equals(snapshotTotalCredit)) {
        await tx.openingBalanceBatch.create({
          data: {
            companyId: scope.companyId,
            branchId: scope.branchId,
            type: 'GL',
            cutoverDate: new Date(Date.UTC(fiscalYear + 1, 0, 1)),
            sourceChecksum: createHash('sha256').update(`year-end-snapshot:${run.id}`).digest('hex'),
            status: OpeningBalanceStatus.VALIDATED,
            operationKey: `year-end-snapshot-${run.id}`,
            totalDebit: snapshotTotalDebit,
            totalCredit: snapshotTotalCredit,
            rowCount: snapshotRows.length,
            validRowCount: snapshotRows.length,
            errorRowCount: 0,
            createdBy: user.sub,
            rows: { createMany: { data: snapshotRows } },
          },
        });
      }

      const control = await tx.accountingCloseControl.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          module: 'ACCOUNTING',
          periodStart: yearStart,
          periodEnd: yearEnd,
          status: 'CLOSED',
          closedById: user.sub,
          closedAt: new Date(),
        },
      });

      const posted = await tx.yearEndCloseRun.update({
        where: { id: run.id },
        data: {
          status: 'POSTED',
          approvedBy: user.sub,
          postedAt: new Date(),
          journalEntryId,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'YEAR_END_CLOSE_POSTED',
          entityType: 'YearEndCloseRun',
          entityId: posted.id,
          payload: { fiscalYear, netIncome: netIncome.toFixed(2), journalEntryId, closeControlId: control.id },
        },
      });
      return posted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async yearEndClose(user: AuthUser, input: any) {
    return this.runYearEndClose(user, input);
  }

  async closeYear(user: AuthUser, input: any) {
    return this.runYearEndClose(user, input);
  }

  async yearEnd(user: AuthUser, input: any) {
    return this.runYearEndClose(user, input);
  }

  async closeFiscalYear(user: AuthUser, input: any) {
    return this.runYearEndClose(user, input);
  }

  async reverseYearEndClose(user: AuthUser, input: any) {
    const scope = this.requireTenantScope(user);
    await this.assertFeatureEnabled(this.prisma, scope);
    const runId = String(input?.runId ?? input?.id ?? '').trim();
    const reason = String(input?.reason ?? '').trim();
    if (!runId || reason.length < 3) throw new BadRequestException({ code: 'YEAR_END_REVERSE_INPUT_INVALID', message: 'runId dan reason wajib diisi.' });
    const operationKey = String(input?.operationKey ?? `year-end-reversal-${runId}`).trim();
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.yearEndCloseRun.findFirst({ where: { id: runId, companyId: scope.companyId, branchId: scope.branchId } });
      if (!run) throw new NotFoundException({ code: 'YEAR_END_RUN_NOT_FOUND', message: 'Run tutup tahun tidak ditemukan.' });
      if (run.status !== 'POSTED') throw new BadRequestException({ code: 'YEAR_END_RUN_NOT_POSTED', message: 'Hanya run POSTED yang dapat dibalik.' });
      if (!run.journalEntryId) throw new BadRequestException({ code: 'YEAR_END_RUN_NO_JOURNAL', message: 'Run tidak memiliki journal entry.' });

      await tx.accountingCloseControl.updateMany({
        where: { companyId: scope.companyId, branchId: scope.branchId, module: 'ACCOUNTING', periodStart: { lte: new Date(Date.UTC(run.fiscalYear, 11, 31)) }, periodEnd: { gte: new Date(Date.UTC(run.fiscalYear, 0, 1)) }, status: 'CLOSED' },
        data: { status: 'OPEN', closedById: null, closedAt: null, reopenReason: reason },
      });

      const existing = await tx.accountingEvent.findFirst({ where: { companyId: scope.companyId, idempotencyKey: operationKey } });
      // replay if already reversed
      if (existing?.reversalOfId === run.journalEntryId ? false : false) {}

      const event = await this.accounting.postReversal(tx, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        originalEventId: (await tx.accountingEvent.findFirstOrThrow({ where: { journalEntryId: run.journalEntryId, companyId: scope.companyId } })).id,
        idempotencyKey: operationKey,
        businessDate: new Date(Date.UTC(run.fiscalYear + 1, 0, 1)),
        reason,
        sourceType: 'YEAR_END_CLOSE_RUN_REVERSAL',
        sourceId: run.id,
      });
      const updated = await tx.yearEndCloseRun.update({
        where: { id: run.id },
        data: { status: 'REVERSED', reversalEventId: event.id },
      });
      await tx.auditLog.create({ data: { companyId: scope.companyId, userId: user.sub, action: 'YEAR_END_CLOSE_REVERSED', entityType: 'YearEndCloseRun', entityId: run.id, payload: { reason, reversalEventId: event.id } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reverseYearEnd(user: AuthUser, input: any) { return this.reverseYearEndClose(user, input); }
  async reverseYearEndCloseRun(user: AuthUser, input: any) { return this.reverseYearEndClose(user, input); }

  private async runCutoverGate(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const batches = await this.prisma.openingBalanceBatch.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      include: { rows: true },
    });
    const allPosted = batches.length > 0 && batches.every((batch) => batch.status === OpeningBalanceStatus.POSTED);
    const noFailedRows = batches.every((batch) => batch.errorRowCount === 0);
    const totalDebit = batches.reduce((total, batch) => total.add(batch.totalDebit), new Prisma.Decimal(0));
    const totalCredit = batches.reduce((total, batch) => total.add(batch.totalCredit), new Prisma.Decimal(0));
    const trialBalance = allPosted && noFailedRows;

    const arBatches = batches.filter((batch) => batch.type === OpeningBalanceType.AR);
    const apBatches = batches.filter((batch) => batch.type === OpeningBalanceType.AP);
    const arDocs = await this.prisma.openingLedgerDocument.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId, kind: OpeningLedgerKind.AR } });
    const apDocs = await this.prisma.openingLedgerDocument.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId, kind: OpeningLedgerKind.AP } });
    const arBatchTotal = arBatches.reduce((total, batch) => total.add(batch.totalDebit), new Prisma.Decimal(0));
    const apBatchTotal = apBatches.reduce((total, batch) => total.add(batch.totalCredit), new Prisma.Decimal(0));
    const arOutstanding = arDocs.reduce((total, doc) => total.add(doc.outstandingAmount), new Prisma.Decimal(0));
    const apOutstanding = apDocs.reduce((total, doc) => total.add(doc.outstandingAmount), new Prisma.Decimal(0));
    const arSubledger = arBatchTotal.equals(arOutstanding);
    const apSubledger = apBatchTotal.equals(apOutstanding);

    const stockBatches = batches.filter((batch) => batch.type === OpeningBalanceType.STOCK);
    const productIds = [...new Set(stockBatches.flatMap((batch) => batch.rows.map((row) => row.productId).filter((id): id is string => Boolean(id))))];
    const warehouseIds = [...new Set(stockBatches.flatMap((batch) => batch.rows.map((row) => row.warehouseId).filter((id): id is string => Boolean(id))))];
    let inventoryCost = true;
    if (productIds.length && warehouseIds.length) {
      const costingEnabled = await this.prisma.featureFlag.findFirst({ where: { companyId: scope.companyId, branchId: scope.branchId, key: 'inventory.costing', enabled: true } });
      if (costingEnabled) {
        const [inventoryRows, costStates] = await Promise.all([
          this.prisma.inventory.findMany({ where: { productId: { in: productIds }, warehouseId: { in: warehouseIds }, warehouse: { branchId: scope.branchId, branch: { companyId: scope.companyId } } } }),
          this.prisma.inventoryCostState.findMany({ where: { companyId: scope.companyId, branchId: scope.branchId, productId: { in: productIds }, warehouseId: { in: warehouseIds } } }),
        ]);
        const inventoryQty = inventoryRows.reduce((total, row) => total + row.quantity, 0);
        const costQty = costStates.reduce((total, row) => total + row.quantity, 0);
        inventoryCost = inventoryQty === costQty;
      }
    }

    const ready = allPosted && noFailedRows && trialBalance && arSubledger && apSubledger && inventoryCost;
    return {
      ready,
      checks: {
        allBatchesPosted: allPosted,
        noFailedRows,
        trialBalance,
        arSubledger,
        apSubledger,
        inventoryCost,
      },
      totals: {
        debit: totalDebit.toFixed(2),
        credit: totalCredit.toFixed(2),
        arOutstanding: arOutstanding.toFixed(2),
        apOutstanding: apOutstanding.toFixed(2),
      },
      batchCount: batches.length,
    };
  }

  async cutover(user: AuthUser) {
    return this.runCutoverGate(user);
  }

  async cutoverGate(user: AuthUser) {
    return this.runCutoverGate(user);
  }

  async checkCutover(user: AuthUser) {
    return this.runCutoverGate(user);
  }

  async getCutoverStatus(user: AuthUser) {
    return this.runCutoverGate(user);
  }

  async cutoverCheck(user: AuthUser) {
    return this.runCutoverGate(user);
  }

  private async tenantBatch(client: DbClient, scope: TenantScope, id: string) {
    const batch = await client.openingBalanceBatch.findFirst({ where: { id, companyId: scope.companyId, branchId: scope.branchId } });
    if (!batch) throw new NotFoundException({ code: 'OPENING_BATCH_NOT_FOUND', message: 'Batch saldo awal tidak ditemukan.' });
    return batch;
  }

  private async transition(user: AuthUser, scope: TenantScope, id: string, from: OpeningBalanceStatus[], data: Prisma.OpeningBalanceBatchUpdateManyMutationInput, action: string, reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.openingBalanceBatch.updateMany({ where: { id, companyId: scope.companyId, branchId: scope.branchId, status: { in: from } }, data });
      if (updated.count !== 1) throw new ConflictException({ code: 'OPENING_BATCH_STATE_CHANGED', message: 'Status batch berubah; muat ulang lalu coba lagi.' });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId, userId: user.sub, action, entityType: 'OpeningBalanceBatch', entityId: id,
          payload: { branchId: scope.branchId, from: from.join(','), to: String(data.status ?? ''), reason: reason || null },
        },
      });
    });
  }
}
