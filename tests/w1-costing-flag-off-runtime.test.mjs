import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-costing-flag-off-'));
const DB = path.join(TMP, 'costing-flag-off.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { SalesService } = await load('apps/api/src/sales/sales.service.ts', opts);
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', opts);
const { StockAlertService } = await load('apps/api/src/sales/stock-alert.service.ts', opts);
const { PromotionsService } = await load('apps/api/src/promotions/promotions.service.ts', opts);
const { SupervisorApprovalService } = await load('apps/api/src/supervisor-approval/supervisor-approval.service.ts', opts);
const { InventoryCostingService } = await load('apps/api/src/inventory/costing.service.ts', opts);

const accounting = new AccountingCoreService(prisma);
const sales = new SalesService(prisma, accounting, new StockAlertService(prisma),
  new PromotionsService(prisma), new SupervisorApprovalService(prisma), new InventoryCostingService());

const COMPANY = 'acme';
const USER = 'u-1';
const BRANCH = 'br-1';
const WAREHOUSE = 'wh-1';
const PLAIN = 'p-plain';
const user = { sub: USER, companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };

const ACCOUNTS = [
  ['1101', 'Kas', 'ASSET'], ['1301', 'Persediaan', 'ASSET'], ['4101', 'Penjualan', 'REVENUE'],
  ['5101', 'Harga Pokok Penjualan', 'EXPENSE'], ['2201', 'Pajak Keluaran', 'LIABILITY'],
];
const RULES = [{
  code: 'SALE-CASH', eventType: 'SALE_CASH', lines: [
    { accountCodeKey: 'settlement', side: 'DEBIT', amountKey: 'settlement' },
    { accountCodeKey: 'revenue', side: 'CREDIT', amountKey: 'revenue' },
    { accountCodeKey: 'outputTax', side: 'CREDIT', amountKey: 'outputTax', skipIfZero: true },
    { accountCodeKey: 'cogs', side: 'DEBIT', amountKey: 'cogs' },
    { accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory' },
  ],
}];

async function seed() {
  await prisma.company.create({ data: { id: COMPANY, name: 'Acme', slug: 'acme', timezone: 'Asia/Makassar', currency: 'IDR' } });
  await prisma.user.create({ data: { id: USER, name: 'Kasir', email: 'costing@test', passwordHash: 'x', isActive: true } });
  await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR1', name: 'Cabang 1', isActive: true } });
  for (const [code, name, type] of ACCOUNTS) {
    await prisma.account.create({ data: { branchId: BRANCH, code, name, type } });
  }
  await prisma.warehouse.create({ data: { id: WAREHOUSE, code: 'W1', name: 'Gudang', branchId: BRANCH, isActive: true, isDefault: true } });
  await prisma.masterReference.create({ data: {
    companyId: COMPANY, branchId: null, type: 'PAYMENT_METHOD', code: 'CASH', name: 'Tunai', isActive: true,
    metadata: {
      kind: 'CASH', settlementAccountCode: '1101', settlementBehavior: 'IMMEDIATE',
      requiresProvider: false, requiresReference: false, refundBehavior: 'CASH', refundAccountCode: '1101',
      allowOffline: true, allowCashChange: true, feeRatePercent: 0,
    },
  } });
  await prisma.masterReference.create({ data: { companyId: COMPANY, type: 'UNIT', code: 'PCS', name: 'Pcs', isActive: true } });
  await prisma.product.create({ data: { id: PLAIN, companyId: COMPANY, sku: 'PLAIN-1', name: 'Biasa', unit: 'PCS', costPrice: 500, salePrice: 800, trackBatch: false } });
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: PLAIN, quantity: 5, available: 5 } });
  for (const rule of RULES) {
    await prisma.accountingPostingRule.create({ data: {
      companyId: COMPANY, code: rule.code, version: 1, name: rule.code, eventType: rule.eventType, status: 'ACTIVE', journalLines: rule.lines,
    } });
  }
  // feature flag DISABLED
  await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'inventory.costing', enabled: false, scope: 'BRANCH' } });
}

const sell = (productId, quantity) => sales.create({ warehouseId: WAREHOUSE, items: [{ productId, quantity }], paymentMethod: 'CASH' }, user);

await seed();

test('flag-disabled sale posts COGS via legacy costTotal and creates zero InventoryCostEvent rows', async () => {
  const created = await sell(PLAIN, 2);
  assert.equal(Number(created.costTotal), 1000, '2 x 500 legacy costPrice');

  const events = await prisma.inventoryCostEvent.findMany({ where: { sourceType: 'Sale', sourceId: created.id } });
  assert.equal(events.length, 0, 'no InventoryCostEvent rows when flag disabled');

  const event = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: created.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: event.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  const cogs = journal.lines.find((line) => line.account.code === '5101');
  const inventory = journal.lines.find((line) => line.account.code === '1301');
  assert.equal(Number(cogs.debit), 1000);
  assert.equal(Number(inventory.credit), 1000);
});
