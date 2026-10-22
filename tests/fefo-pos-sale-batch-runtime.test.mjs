// POS sale must consume batch stock, not only aggregate Inventory.
//
// The drift this locks down: `InventoryBatch.quantity` is the sum-of-batches truth for
// batch-tracked goods, while `Inventory.quantity` is the aggregate the till decrements. Before
// this test the POS path decremented Inventory and location balances but never touched batches,
// so every sale silently inflated "batch stock" relative to the warehouse total. Orders already
// consumed batches; the same FEFO helper is now called from `SalesService.create`.
//
// Executed, not grepped: a real SQLite database, the real SalesService, four batches (expired,
// near-expiry, later expiry, no expiry), and the aggregate/sum invariant read back from the DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-fefo-pos-'));
const DB = path.join(TMP, 'fefo-pos.db');

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

const sales = new SalesService(prisma, new AccountingCoreService(prisma), new StockAlertService(prisma),
  new PromotionsService(prisma), new SupervisorApprovalService(prisma), new InventoryCostingService());

const COMPANY = 'acme';
const USER = 'u-1';
const BRANCH = 'br-1';
const WAREHOUSE = 'wh-1';
const BATCHED = 'p-batch';
const PLAIN = 'p-plain';
const user = { sub: USER, companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };

const ACCOUNTS = [
  ['1101', 'Kas', 'ASSET'], ['1301', 'Persediaan', 'ASSET'], ['2201', 'Pajak Keluaran', 'LIABILITY'],
  ['4101', 'Penjualan', 'REVENUE'], ['5101', 'Harga Pokok Penjualan', 'EXPENSE'],
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

const day = (offset) => new Date(Date.now() + offset * 86_400_000);

async function seed() {
  await prisma.company.upsert({ where: { id: COMPANY }, update: {}, create: { id: COMPANY, name: 'Acme', slug: 'acme', timezone: 'Asia/Makassar', currency: 'IDR' } });
  await prisma.user.upsert({ where: { email: 'fefo@test' }, update: {}, create: { id: USER, name: 'Kasir', email: 'fefo@test', passwordHash: 'x', isActive: true } });
  await prisma.branch.upsert({ where: { id: BRANCH }, update: {}, create: { id: BRANCH, companyId: COMPANY, code: 'BR1', name: 'Cabang 1', isActive: true } });
  for (const [code, name, type] of ACCOUNTS) {
    await prisma.account.upsert({ where: { branchId_code: { branchId: BRANCH, code } }, update: { name, type }, create: { branchId: BRANCH, code, name, type } });
  }
  await prisma.warehouse.upsert({ where: { id: WAREHOUSE }, update: {}, create: { id: WAREHOUSE, code: 'W1', name: 'Gudang', branchId: BRANCH, isActive: true, isDefault: true } });
  await prisma.masterReference.upsert({
    where: { companyId_type_code: { companyId: COMPANY, type: 'PAYMENT_METHOD', code: 'CASH' } },
    update: {
      name: 'Tunai', isActive: true,
      metadata: {
        kind: 'CASH', settlementAccountCode: '1101', settlementBehavior: 'IMMEDIATE',
        requiresProvider: false, requiresReference: false, refundBehavior: 'CASH', refundAccountCode: '1101',
        allowOffline: true, allowCashChange: true, feeRatePercent: 0,
      },
    },
    create: {
      companyId: COMPANY, branchId: null, type: 'PAYMENT_METHOD', code: 'CASH', name: 'Tunai', isActive: true,
      metadata: {
        kind: 'CASH', settlementAccountCode: '1101', settlementBehavior: 'IMMEDIATE',
        requiresProvider: false, requiresReference: false, refundBehavior: 'CASH', refundAccountCode: '1101',
        allowOffline: true, allowCashChange: true, feeRatePercent: 0,
      },
    },
  });
  await prisma.masterReference.upsert({
    where: { companyId_type_code: { companyId: COMPANY, type: 'UNIT', code: 'PCS' } },
    update: { name: 'Pcs', isActive: true },
    create: { companyId: COMPANY, type: 'UNIT', code: 'PCS', name: 'Pcs', isActive: true },
  });
  await prisma.product.upsert({
    where: { id: BATCHED },
    update: { trackBatch: true, trackExpiry: true },
    create: { id: BATCHED, companyId: COMPANY, sku: 'BATCH-1', name: 'Produk Batch', unit: 'PCS', costPrice: 1000, salePrice: 2000, trackBatch: true, trackExpiry: true },
  });
  await prisma.product.upsert({
    where: { id: PLAIN },
    update: { trackBatch: false },
    create: { id: PLAIN, companyId: COMPANY, sku: 'PLAIN-1', name: 'Produk Biasa', unit: 'PCS', costPrice: 500, salePrice: 800, trackBatch: false },
  });
  for (const [productId, quantity] of [[BATCHED, 105], [PLAIN, 50]]) {
    await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId } },
      update: { quantity, available: quantity },
      create: { warehouseId: WAREHOUSE, productId, quantity, available: quantity },
    });
  }
  // 105 BATANG = 5 expired + 10 near-expiry + 30 later + 60 no-expiry. Sum must stay equal to Inventory.
  for (const [batchNumber, quantity, expiryDate, createdAt] of [
    ['EXPIRED', 5, day(-1), new Date('2026-01-01T00:00:00Z')],
    ['EARLY', 10, day(2), new Date('2026-01-02T00:00:00Z')],
    ['LATE', 30, day(5), new Date('2026-01-03T00:00:00Z')],
    ['NO-EXPIRY', 60, null, new Date('2026-01-04T00:00:00Z')],
  ]) {
    await prisma.inventoryBatch.upsert({
      where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber } },
      update: { quantity, expiryDate, createdAt },
      create: { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber, quantity, expiryDate, createdAt },
    });
  }
  for (const rule of RULES) {
    await prisma.accountingPostingRule.upsert({
      where: { companyId_code_version: { companyId: COMPANY, code: rule.code, version: 1 } },
      update: {}, create: { companyId: COMPANY, code: rule.code, version: 1, name: rule.code, eventType: rule.eventType, status: 'ACTIVE', journalLines: rule.lines },
    });
  }
}

async function batchQuantities() {
  const rows = await prisma.inventoryBatch.findMany({ where: { warehouseId: WAREHOUSE, productId: BATCHED }, orderBy: { batchNumber: 'asc' } });
  return Object.fromEntries(rows.map((row) => [row.batchNumber, row.quantity]));
}
async function aggregate(productId) {
  return prisma.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId } } });
}
async function saleCount() {
  return prisma.sale.count();
}
const sell = (productId, quantity) => sales.create({ warehouseId: WAREHOUSE, items: [{ productId, quantity }], paymentMethod: 'CASH' }, user);

await seed();

test('POS sale consumes batches FEFO and never the expired batch', async () => {
  const before = await batchQuantities();
  assert.deepEqual(before, { EARLY: 10, EXPIRED: 5, LATE: 30, 'NO-EXPIRY': 60 }, 'fixture awal harus utuh');

  const created = await sell(BATCHED, 25);
  assert.equal(created.items[0].quantity, 25, 'SaleItem menyimpan kuantitas base unit');
  assert.deepEqual(await batchQuantities(), { EARLY: 0, EXPIRED: 5, LATE: 15, 'NO-EXPIRY': 60 },
    '25 unit harus menghabiskan EARLY lalu LATE; batch EXPIRED tidak boleh tersentuh');

  const stock = await aggregate(BATCHED);
  assert.equal(stock.quantity, 80, 'Inventory turun 25');
  assert.equal(stock.available, 80);
  const batches = await prisma.inventoryBatch.aggregate({ where: { warehouseId: WAREHOUSE, productId: BATCHED }, _sum: { quantity: true } });
  assert.equal(batches._sum.quantity, stock.quantity, 'sum batch harus sama dengan Inventory setelah penjualan');

  const movements = await prisma.inventoryMovement.aggregate({ where: { referenceType: 'Sale', referenceId: created.id, productId: BATCHED }, _sum: { quantity: true } });
  assert.equal(movements._sum.quantity, -25, 'movement append-only mencatat -25');
});

test('a sale larger than free batch stock fails closed and writes nothing', async () => {
  const salesBefore = await saleCount();
  await assert.rejects(() => sell(BATCHED, 76),
    (error) => {
      assert.match(String(error.message), /Stok batch bebas tidak mencukupi/);
      return true;
    });
  assert.equal(await saleCount(), salesBefore, 'tidak boleh ada Sale setengah jadi');
  assert.deepEqual(await batchQuantities(), { EARLY: 0, EXPIRED: 5, LATE: 15, 'NO-EXPIRY': 60 }, 'batch tidak berubah');
  assert.equal((await aggregate(BATCHED)).quantity, 80, 'Inventory tidak berubah');
});

test('selling exactly the free quantity leaves only the expired batch', async () => {
  await sell(BATCHED, 75);
  assert.deepEqual(await batchQuantities(), { EARLY: 0, EXPIRED: 5, LATE: 0, 'NO-EXPIRY': 0 });
  const stock = await aggregate(BATCHED);
  assert.equal(stock.quantity, 5, 'sisa 5 unit adalah batch expired yang tidak bisa dijual');
  await assert.rejects(() => sell(BATCHED, 1), /Stok batch bebas tidak mencukupi/);
});

test('products without batch tracking still sell without touching the batch book', async () => {
  const created = await sell(PLAIN, 2);
  assert.equal(created.items[0].quantity, 2);
  assert.equal((await aggregate(PLAIN)).quantity, 48);
  assert.deepEqual(await batchQuantities(), { EARLY: 0, EXPIRED: 5, LATE: 0, 'NO-EXPIRY': 0 }, 'batch produk lain tidak boleh berubah');
});

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});
