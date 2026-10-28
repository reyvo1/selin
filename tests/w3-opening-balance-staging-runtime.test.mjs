import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-opening-staging-'));
const DB = path.join(TMP, 'opening-staging.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const { OpeningBalanceService } = await load('apps/api/src/opening-balance/opening-balance.service.ts', { platform: 'node', external: ['@prisma/client'] });
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', { platform: 'node', external: ['@prisma/client'] });
const service = new OpeningBalanceService(prisma, new AccountingCoreService(prisma));

const COMPANY = 'co-opening-staging';
const BRANCH = 'br-opening-staging';
const OTHER_BRANCH = 'br-opening-other';
const MAKER = { sub: 'u-maker', email: 'maker@test', name: 'Maker', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };
const CHECKER = { sub: 'u-checker', email: 'checker@test', name: 'Checker', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };
const OUTSIDER = { sub: 'u-outsider', email: 'outsider@test', name: 'Outsider', companyId: COMPANY, branchId: OTHER_BRANCH, roles: ['FINANCE'], permissions: [] };
const at = (value) => new Date(`${value}T00:00:00Z`);
const rejectsCode = (fn, code) => assert.rejects(fn, (error) => {
  const response = error?.getResponse?.();
  return response?.code === code || String(error?.message ?? '').includes(code);
});

await prisma.company.create({ data: { id: COMPANY, name: 'Opening Staging Co', slug: 'opening-staging-co', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: MAKER.sub, name: 'Maker', email: MAKER.email, passwordHash: 'x', isActive: true },
  { id: CHECKER.sub, name: 'Checker', email: CHECKER.email, passwordHash: 'x', isActive: true },
  { id: OUTSIDER.sub, name: 'Outsider', email: OUTSIDER.email, passwordHash: 'x', isActive: true },
] });
await prisma.branch.createMany({ data: [
  { id: BRANCH, companyId: COMPANY, code: 'BR-OS', name: 'Opening Staging', isActive: true },
  { id: OTHER_BRANCH, companyId: COMPANY, code: 'BR-OT', name: 'Opening Other', isActive: true },
] });
await prisma.warehouse.create({ data: { id: 'wh-main', branchId: BRANCH, code: 'WH-OS', name: 'Gudang Opening', isActive: true } });
await prisma.warehouseLocation.create({ data: { id: 'loc-main', warehouseId: 'wh-main', code: 'DEFAULT', name: 'Default', isActive: true } });
await prisma.product.createMany({ data: [
  { id: 'prod-tracked', companyId: COMPANY, sku: 'SKU-TRACKED', name: 'Produk Batch', unit: 'PCS', costPrice: 10, salePrice: 15, trackBatch: true, trackExpiry: true },
  { id: 'prod-serial', companyId: COMPANY, sku: 'SKU-SERIAL', name: 'Produk Serial', unit: 'PCS', costPrice: 10, salePrice: 15, trackSerial: true },
] });
await prisma.customer.create({ data: { id: 'cust-1', companyId: COMPANY, name: 'Pelanggan Opening' } });
await prisma.supplier.create({ data: { id: 'supp-1', companyId: COMPANY, code: 'SUP-1', name: 'Supplier Opening' } });
await prisma.account.createMany({ data: [
  { id: 'acc-cash', branchId: BRANCH, code: '1101', name: 'Kas', type: 'ASSET', isActive: true },
  { id: 'acc-ar', branchId: BRANCH, code: '1201', name: 'Piutang Usaha', type: 'ASSET', isActive: true },
  { id: 'acc-inventory', branchId: BRANCH, code: '1301', name: 'Persediaan', type: 'ASSET', isActive: true },
  { id: 'acc-ap', branchId: BRANCH, code: '2101', name: 'Utang Usaha', type: 'LIABILITY', isActive: true },
  { id: 'acc-equity', branchId: BRANCH, code: '3101', name: 'Modal', type: 'EQUITY', isActive: true },
  { id: 'acc-revenue', branchId: BRANCH, code: '4101', name: 'Pendapatan', type: 'REVENUE', isActive: true },
  { id: 'acc-inactive', branchId: BRANCH, code: '1800', name: 'Akun Nonaktif', type: 'ASSET', isActive: false },
] });
const tax = await prisma.taxCode.create({ data: {
  id: 'tax-ppn', companyId: COMPANY, code: 'PPN11', version: 2, name: 'PPN 11%', scope: 'SALE', rate: 11, inclusive: false, status: 'ACTIVE',
} });

const stockRows = (overrides = {}) => [{
  productId: 'prod-tracked', warehouseId: 'wh-main', locationCode: 'DEFAULT', batchNumber: 'BATCH-1',
  expiryDate: '2030-01-01', quantity: 5, unitCost: '20.00', ...overrides,
}];
const ledgerRow = (overrides = {}) => ({
  customerId: 'cust-1', documentNumber: 'INV-OPEN-1', documentDate: '2026-01-10', dueDate: '2026-02-10',
  subtotal: '100.00', taxCodeId: tax.id, taxCodeVersion: 2, total: '111.00', paidAmount: '11.00', ...overrides,
});
const glRows = [
  { accountCode: '1101', debit: '100.00', description: 'Kas awal' },
  { accountCode: '3101', credit: '100.00', description: 'Modal awal' },
];

after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('preview validates CSV and rows without persisting, and blocks xlsx or ambiguous sources', async () => {
  const csv = [
    'productId,warehouseId,locationCode,batchNumber,expiryDate,quantity,unitCost,description',
    'prod-tracked,wh-main,DEFAULT,BATCH-1,2030-01-01,5,20.00,"Baris, pertama"',
    'missing-product,wh-main,DEFAULT,BATCH-2,2030-01-01,1,2.00,"Baris kedua"',
  ].join('\n');
  const preview = await service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', csv, sourceFileName: 'stock.csv' });
  assert.equal(preview.dryRun, true);
  assert.equal(preview.rowCount, 2);
  assert.equal(preview.validRowCount, 1);
  assert.equal(preview.errorRowCount, 1);
  assert.equal(preview.errors[0].rowNumber, 3);
  assert.equal(preview.errors[0].code, 'OPENING_STOCK_PRODUCT_NOT_FOUND');
  assert.equal(await prisma.openingBalanceBatch.count(), 0);
  await rejectsCode(() => service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', csv, rows: stockRows() }), 'OPENING_IMPORT_SOURCE_AMBIGUOUS');
  await rejectsCode(() => service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', csv: 'PK\\u0003\\u0004binary', sourceFileName: 'stock.xlsx' }), 'OPENING_IMPORT_XLSX_PARSER_NOT_APPROVED');
});

test('feature flag is required for writes but not for dry-run, and stock staging enforces batch fields', async () => {
  await rejectsCode(() => service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', operationKey: 'opening-stock-disabled', rows: stockRows(),
  }), 'OPENING_BALANCE_DISABLED');
  const preview = await service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', rows: stockRows() });
  assert.equal(preview.errorRowCount, 0);
  await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end', scope: 'BRANCH', enabled: true } });
  const missingBatch = await service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', rows: stockRows({ batchNumber: undefined }) });
  assert.equal(missingBatch.errors[0].code, 'OPENING_STOCK_BATCH_REQUIRED');
  const serial = await service.preview(MAKER, { type: 'STOCK', cutoverDate: '2026-01-01', rows: stockRows({ productId: 'prod-serial' }) });
  assert.equal(serial.errors[0].code, 'OPENING_STOCK_SERIAL_UNSUPPORTED');
});

test('feature flag resolution lets a disabled branch override an enabled global flag', async () => {
  await prisma.featureFlag.create({ data: { companyId: null, branchId: null, key: 'accounting.opening_and_year_end', scope: 'GLOBAL', enabled: true } });
  await prisma.featureFlag.updateMany({ where: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end' }, data: { enabled: false } });
  await rejectsCode(() => service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', operationKey: 'opening-stock-branch-disabled', rows: stockRows(),
  }), 'OPENING_BALANCE_DISABLED');
  await prisma.featureFlag.updateMany({ where: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end' }, data: { enabled: true } });
});

test('stock batch persists validated rows, totals, replay and tenant-scoped pagination', async () => {
  const batch = await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', operationKey: 'opening-stock-1', sourceFileName: 'stock.json', rows: stockRows(),
  });
  assert.equal(batch.status, 'VALIDATED');
  assert.equal(batch.rowCount, 1);
  assert.equal(batch.validRowCount, 1);
  assert.equal(batch.errorRowCount, 0);
  assert.equal(batch.totalDebit, '100.00');
  assert.equal(batch.totalCredit, '0.00');

  const stored = await prisma.openingBalanceRow.findMany({ where: { batchId: batch.id } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, 'VALID');
  assert.equal(stored[0].debit.toFixed(2), '100.00');
  assert.equal(stored[0].batchNumber, 'BATCH-1');
  assert.equal(stored[0].rawPayload.description, null);

  const replay = await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', operationKey: 'opening-stock-1', sourceFileName: 'stock.json', rows: stockRows(),
  });
  assert.equal(replay.id, batch.id);
  assert.equal(await prisma.openingBalanceBatch.count(), 1);
  await rejectsCode(() => service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-02', operationKey: 'opening-stock-1', rows: stockRows(),
  }), 'OPENING_OPERATION_KEY_CONFLICT');

  const list = await service.list(MAKER, { type: 'STOCK', limit: '1' });
  assert.equal(list.items.length, 1);
  assert.equal(list.pageInfo.hasMore, false);
  const rows = await service.rows(MAKER, batch.id, { limit: '1' });
  assert.equal(rows.items.length, 1);
  assert.equal(rows.items[0].rowNumber, 1);
  await rejectsCode(() => service.get(OUTSIDER, batch.id), 'OPENING_BATCH_NOT_FOUND');
});

test('stock staging exposes row errors and marks the batch FAILED', async () => {
  const batch = await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', operationKey: 'opening-stock-failed',
    rows: [stockRows()[0], stockRows({ productId: 'missing-product' })[0]],
  });
  assert.equal(batch.status, 'FAILED');
  assert.equal(batch.validRowCount, 1);
  assert.equal(batch.errorRowCount, 1);
  const row = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: batch.id, rowNumber: 2 } });
  assert.equal(row.status, 'ERROR');
  assert.equal(row.errorCode, 'OPENING_STOCK_PRODUCT_NOT_FOUND');
  await rejectsCode(() => service.submit(MAKER, batch.id), 'OPENING_BATCH_NOT_SUBMITTABLE');
});

test('AR staging snapshots tax, computes outstanding, and rejects duplicate documents and invalid accounts', async () => {
  const preview = await service.preview(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', rows: [ledgerRow(), ledgerRow({ documentNumber: 'INV-OPEN-1' })],
  });
  assert.equal(preview.errorRowCount, 1);
  assert.equal(preview.errors[0].code, 'OPENING_LEDGER_DOCUMENT_DUPLICATE');
  await rejectsCode(() => service.preview(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '2101', rows: [ledgerRow()],
  }), 'OPENING_BATCH_CONTROL_ACCOUNT_INVALID');

  const batch = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-1', rows: [ledgerRow()],
  });
  assert.equal(batch.status, 'VALIDATED');
  assert.equal(batch.totalDebit, '100.00');
  const row = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: batch.id } });
  assert.equal(row.taxCodeVersion, 2);
  assert.equal(row.taxRateSnapshot.toFixed(2), '11.00');
  assert.equal(row.taxAmount.toFixed(2), '11.00');
  assert.equal(row.total.toFixed(2), '111.00');
  assert.equal(row.paidAmount.toFixed(2), '11.00');
  assert.equal(row.debit.toFixed(2), '100.00');
  assert.equal(row.credit.toFixed(2), '0.00');
  assert.equal(row.accountCode, '1201');
  const duplicate = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-2',
    rows: [ledgerRow({ documentNumber: 'INV-OPEN-1' })],
  });
  assert.equal(duplicate.status, 'FAILED');
  assert.equal(duplicate.errorRowCount, 1);
  const duplicateRow = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: duplicate.id } });
  assert.equal(duplicateRow.errorCode, 'OPENING_LEDGER_DOCUMENT_DUPLICATE');
});

test('cancelled batches release document numbers and replay bypasses reference validation', async () => {
  const rows = [ledgerRow({ documentNumber: 'INV-CANCEL-1' })];
  const first = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-cancel-1', rows,
  });
  const second = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-cancel-2', rows,
  });
  assert.equal(second.status, 'FAILED');
  await service.cancel(MAKER, first.id, { reason: 'Ganti batch' });
  await service.cancel(MAKER, second.id, { reason: 'Batch duplikat' });
  const third = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-cancel-3', rows,
  });
  assert.equal(third.status, 'VALIDATED');

  await prisma.customer.update({ where: { id: 'cust-1' }, data: { companyId: null } });
  const replay = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-cancel-3', rows,
  });
  assert.equal(replay.id, third.id);
  await prisma.customer.update({ where: { id: 'cust-1' }, data: { companyId: COMPANY } });
});

test('AP staging derives credit outstanding with supplier control', async () => {
  const batch = await service.create(MAKER, {
    type: 'AP', cutoverDate: '2026-01-31', controlAccountCode: '2101', operationKey: 'opening-ap-1',
    rows: [{ supplierId: 'supp-1', documentNumber: 'BILL-OPEN-1', documentDate: '2026-01-05', dueDate: '2026-02-05', total: '75.00' }],
  });
  assert.equal(batch.status, 'VALIDATED');
  assert.equal(batch.totalCredit, '75.00');
  const row = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: batch.id } });
  assert.equal(row.debit.toFixed(2), '0.00');
  assert.equal(row.credit.toFixed(2), '75.00');
  assert.equal(row.documentNumber, 'BILL-OPEN-1');
});

test('GL staging requires a balanced batch and maker-checker approval transitions', async () => {
  await rejectsCode(() => service.create(MAKER, {
    type: 'GL', cutoverDate: '2026-01-01', operationKey: 'opening-gl-unbalanced',
    rows: [{ accountCode: '1101', debit: '100.00' }, { accountCode: '3101', credit: '99.99' }],
  }), 'OPENING_GL_UNBALANCED');
  const batch = await service.create(MAKER, { type: 'GL', cutoverDate: '2026-01-01', operationKey: 'opening-gl-1', rows: glRows });
  assert.equal(batch.status, 'VALIDATED');
  assert.equal(batch.totalDebit, '100.00');
  assert.equal(batch.totalCredit, '100.00');

  const submitted = await service.submit(MAKER, batch.id);
  assert.equal(submitted.status, 'WAITING_APPROVAL');
  await rejectsCode(() => service.approve(MAKER, batch.id), 'OPENING_MAKER_CHECKER_REQUIRED');
  const approved = await service.approve(CHECKER, batch.id, 'Saldo awal disetujui');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.approvedBy, CHECKER.sub);
  const audit = await prisma.auditLog.findFirst({ where: { entityId: batch.id, action: 'OPENING_BALANCE_BATCH_APPROVED' } });
  assert.equal(audit.userId, CHECKER.sub);
  await rejectsCode(() => service.cancel(MAKER, batch.id, { reason: 'Batal setelah approve' }), 'OPENING_BATCH_NOT_CANCELLABLE');
});

test('revalidation replaces rows and returns a failed batch when references disappear', async () => {
  const batch = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-31', controlAccountCode: '1201', operationKey: 'opening-ar-revalidate', rows: [ledgerRow({ documentNumber: 'INV-REVAL-1' })],
  });
  assert.equal(batch.status, 'VALIDATED');
  await prisma.customer.update({ where: { id: 'cust-1' }, data: { companyId: null } });
  const revalidated = await service.revalidate(MAKER, batch.id, { reason: 'Customer berubah' });
  assert.equal(revalidated.status, 'FAILED');
  assert.equal(revalidated.errorRowCount, 1);
  const row = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: batch.id } });
  assert.equal(row.errorCode, 'OPENING_LEDGER_CUSTOMER_NOT_FOUND');
  await prisma.customer.update({ where: { id: 'cust-1' }, data: { companyId: COMPANY } });
});

test('GL staging rejects profit-and-loss accounts', async () => {
  const preview = await service.preview(MAKER, {
    type: 'GL', cutoverDate: '2026-01-02',
    rows: [{ accountCode: '4101', debit: '100.00' }, { accountCode: '3101', credit: '100.00' }],
  });
  assert.equal(preview.errorRowCount, 1);
  assert.equal(preview.errors[0].code, 'OPENING_GL_ACCOUNT_TYPE_INVALID');
});

test('GL posting creates one balanced system journal, replays safely, and respects the feature flag', async () => {
  const batch = await service.create(MAKER, {
    type: 'GL', cutoverDate: '2026-01-03', operationKey: 'opening-gl-post-1',
    rows: [{ accountCode: '1101', debit: '125.50', description: 'Kas awal' }, { accountCode: '3101', credit: '125.50', description: 'Modal awal' }],
  });
  await service.submit(MAKER, batch.id);
  await service.approve(CHECKER, batch.id, 'Setuju posting GL');

  await prisma.featureFlag.updateMany({ where: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end' }, data: { enabled: false } });
  await rejectsCode(() => service.post(CHECKER, batch.id), 'OPENING_BALANCE_DISABLED');
  await prisma.featureFlag.updateMany({ where: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end' }, data: { enabled: true } });

  const posted = await service.post(CHECKER, batch.id);
  assert.equal(posted.status, 'POSTED');
  assert.ok(posted.postedAt);
  assert.equal(await prisma.openingBalanceRow.count({ where: { batchId: batch.id, status: 'POSTED', postedAt: { not: null } } }), 2);

  const event = await prisma.accountingEvent.findUniqueOrThrow({
    where: { companyId_idempotencyKey: { companyId: COMPANY, idempotencyKey: `opening-gl:${batch.id}` } },
    include: { lines: true, postings: true },
  });
  assert.equal(event.eventType, 'OPENING_BALANCE');
  assert.equal(event.sourceType, 'OPENING_BALANCE_BATCH');
  assert.equal(event.sourceId, batch.id);
  assert.equal(event.status, 'POSTED');
  assert.equal(event.postings.length, 1);
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: event.journalEntryId }, include: { lines: true } });
  const debit = journal.lines.reduce((total, line) => total.add(line.debit), new Prisma.Decimal(0));
  const credit = journal.lines.reduce((total, line) => total.add(line.credit), new Prisma.Decimal(0));
  assert.equal(debit.toFixed(2), '125.50');
  assert.equal(credit.toFixed(2), '125.50');
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: batch.id, action: 'OPENING_BALANCE_BATCH_POSTED' } });
  assert.equal(audit.userId, CHECKER.sub);

  const replay = await service.post(CHECKER, batch.id);
  assert.equal(replay.status, 'POSTED');
  assert.equal(await prisma.accountingEvent.count({ where: { companyId: COMPANY, sourceId: batch.id, sourceType: 'OPENING_BALANCE_BATCH' } }), 1);
  assert.equal(await prisma.journalEntry.count({ where: { referenceId: batch.id, referenceType: 'OPENING_BALANCE_BATCH' } }), 1);
});

test('GL staging rejects accounts already covered by another opening batch', async () => {
  await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-04', controlAccountCode: '1301', operationKey: 'opening-stock-gl-control',
    rows: stockRows({ batchNumber: 'BATCH-GL-CONTROL' }),
  });
  await rejectsCode(() => service.preview(MAKER, {
    type: 'GL', cutoverDate: '2026-01-04',
    rows: [{ accountCode: '1301', debit: '100.00' }, { accountCode: '3101', credit: '100.00' }],
  }), 'OPENING_GL_CONTROL_ACCOUNT_CONFLICT');
});

test('AR and AP posting creates ledger documents and journals without duplicating on replay', async () => {
  const ar = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-05', controlAccountCode: '1201', offsetAccountCode: '3101', operationKey: 'opening-ar-post-1',
    rows: [ledgerRow({ documentNumber: 'INV-POST-AR-1', documentDate: '2026-01-02', dueDate: '2026-02-02' })],
  });
  await service.submit(MAKER, ar.id);
  await service.approve(CHECKER, ar.id, 'Setuju posting AR');
  const postedAr = await service.post(CHECKER, ar.id);
  assert.equal(postedAr.status, 'POSTED');
  assert.equal(postedAr.postedAt !== null, true);

  const arRow = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: ar.id } });
  const arDocument = await prisma.openingLedgerDocument.findUniqueOrThrow({ where: { rowId: arRow.id } });
  assert.equal(arDocument.kind, 'AR');
  assert.equal(arDocument.status, 'OPEN');
  assert.equal(arDocument.outstandingAmount.toFixed(2), '100.00');
  assert.equal(arDocument.settledAmount.toFixed(2), '0.00');
  assert.equal(arRow.status, 'POSTED');

  const arEvent = await prisma.accountingEvent.findUniqueOrThrow({
    where: { companyId_idempotencyKey: { companyId: COMPANY, idempotencyKey: `opening-ar:${ar.id}` } },
  });
  const arJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: arEvent.journalEntryId }, include: { lines: true } });
  const arDebit = arJournal.lines.reduce((total, line) => total.add(line.debit), new Prisma.Decimal(0));
  const arCredit = arJournal.lines.reduce((total, line) => total.add(line.credit), new Prisma.Decimal(0));
  assert.equal(arDebit.toFixed(2), '100.00');
  assert.equal(arCredit.toFixed(2), '100.00');
  assert.equal(await prisma.taxTransaction.count({ where: { accountingEventId: arEvent.id } }), 0);

  await service.post(CHECKER, ar.id);
  assert.equal(await prisma.openingLedgerDocument.count({ where: { row: { batchId: ar.id } } }), 1);
  assert.equal(await prisma.accountingEvent.count({ where: { companyId: COMPANY, sourceId: ar.id, sourceType: 'OPENING_BALANCE_BATCH' } }), 1);

  const ap = await service.create(MAKER, {
    type: 'AP', cutoverDate: '2026-01-05', controlAccountCode: '2101', offsetAccountCode: '1101', operationKey: 'opening-ap-post-1',
    rows: [{ supplierId: 'supp-1', documentNumber: 'BILL-POST-AP-1', documentDate: '2026-01-03', dueDate: '2026-02-03', total: '50.00' }],
  });
  await service.submit(MAKER, ap.id);
  await service.approve(CHECKER, ap.id, 'Setuju posting AP');
  const postedAp = await service.post(CHECKER, ap.id);
  assert.equal(postedAp.status, 'POSTED');

  const apRow = await prisma.openingBalanceRow.findFirstOrThrow({ where: { batchId: ap.id } });
  const apDocument = await prisma.openingLedgerDocument.findUniqueOrThrow({ where: { rowId: apRow.id } });
  assert.equal(apDocument.kind, 'AP');
  assert.equal(apDocument.outstandingAmount.toFixed(2), '50.00');

  const apEvent = await prisma.accountingEvent.findUniqueOrThrow({
    where: { companyId_idempotencyKey: { companyId: COMPANY, idempotencyKey: `opening-ap:${ap.id}` } },
  });
  const apJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: apEvent.journalEntryId }, include: { lines: true } });
  const apDebit = apJournal.lines.reduce((total, line) => total.add(line.debit), new Prisma.Decimal(0));
  const apCredit = apJournal.lines.reduce((total, line) => total.add(line.credit), new Prisma.Decimal(0));
  assert.equal(apDebit.toFixed(2), '50.00');
  assert.equal(apCredit.toFixed(2), '50.00');
});

test('posting rejects stock batches and AR batches without an offset account', async () => {
  const stock = await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-06', controlAccountCode: '1301', operationKey: 'opening-stock-post-guard',
    rows: stockRows({ batchNumber: 'BATCH-POST-GUARD' }),
  });
  await service.submit(MAKER, stock.id);
  await service.approve(CHECKER, stock.id, 'Setuju stock');
  await rejectsCode(() => service.post(CHECKER, stock.id), 'OPENING_BATCH_OFFSET_ACCOUNT_REQUIRED');

  const ar = await service.create(MAKER, {
    type: 'AR', cutoverDate: '2026-01-06', controlAccountCode: '1201', operationKey: 'opening-ar-missing-offset',
    rows: [ledgerRow({ documentNumber: 'INV-POST-NOOFFSET', documentDate: '2026-01-02', dueDate: '2026-02-02' })],
  });
  await service.submit(MAKER, ar.id);
  await service.approve(CHECKER, ar.id, 'Setuju AR');
  await rejectsCode(() => service.post(CHECKER, ar.id), 'OPENING_BATCH_OFFSET_ACCOUNT_REQUIRED');
});
