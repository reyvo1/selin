import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-costing-sale-'));
const DB = path.join(TMP, 'costing-sale.db');

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
const { ReturnsService } = await load('apps/api/src/returns/returns.service.ts', opts);
const { OrdersService } = await load('apps/api/src/orders/orders.service.ts', opts);
const { AdvancedInventoryService } = await load('apps/api/src/advanced-inventory/advanced-inventory.service.ts', opts);
const { ManufacturingService } = await load('apps/api/src/manufacturing/manufacturing.service.ts', opts);
const { AssetsService } = await load('apps/api/src/assets/assets.service.ts', opts);
const { InventoryCostingPolicyService } = await load('apps/api/src/inventory/costing-policy.service.ts', opts);
const { InventoryCostingReportService } = await load('apps/api/src/inventory/costing-report.service.ts', opts);
const { InventoryCostingRebuildService } = await load('apps/api/src/inventory/costing-rebuild.service.ts', opts);

const accounting = new AccountingCoreService(prisma);
const sales = new SalesService(prisma, accounting, new StockAlertService(prisma),
  new PromotionsService(prisma), new SupervisorApprovalService(prisma), new InventoryCostingService());
const returns = new ReturnsService(prisma, accounting, null, null, new InventoryCostingService());
const orders = new OrdersService(prisma, accounting, { get: () => undefined }, null, null, new InventoryCostingService());
const advanced = new AdvancedInventoryService(prisma, accounting, new InventoryCostingService());
const manufacturing = new ManufacturingService(prisma, accounting, new InventoryCostingService());
const assets = new AssetsService(prisma, accounting, new InventoryCostingService());
const costingPolicies = new InventoryCostingPolicyService(prisma);
const costingReports = new InventoryCostingReportService(prisma);
const costingRebuilds = new InventoryCostingRebuildService(prisma);

const COMPANY = 'acme';
const USER = 'u-1';
const BRANCH = 'br-1';
const WAREHOUSE = 'wh-1';
const BATCHED = 'p-batched';
const PLAIN = 'p-plain';
const NO_COST = 'p-no-cost';
const ORDER_PRODUCT = 'p-order';
const user = { sub: USER, companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const approver = { ...user, sub: 'u-2', email: 'approver@test', roles: ['FINANCE'] };
const day = (offset) => new Date(Date.now() + offset * 86_400_000);

const ACCOUNTS = [
  ['1101', 'Kas', 'ASSET'], ['1301', 'Persediaan', 'ASSET'], ['1302', 'Persediaan Dalam Perjalanan', 'ASSET'], ['1303', 'Barang Dalam Proses', 'ASSET'], ['5203', 'Beban Pemeliharaan', 'EXPENSE'], ['4201', 'Pendapatan Lain', 'REVENUE'], ['5102', 'Beban Selisih Persediaan', 'EXPENSE'], ['2201', 'Pajak Keluaran', 'LIABILITY'],
  ['4101', 'Penjualan', 'REVENUE'], ['4102', 'Retur Penjualan', 'REVENUE'], ['5101', 'Harga Pokok Penjualan', 'EXPENSE'],
  ['2101', 'Utang Usaha', 'LIABILITY'], ['2105', 'Uang Muka Pelanggan', 'LIABILITY'], ['1202', 'Piutang Refund Supplier', 'ASSET'], ['1205', 'Pajak Masukan', 'ASSET'],
  ['4203', 'Keuntungan Selisih Harga Beli', 'REVENUE'], ['5103', 'Kerugian Selisih Harga Beli', 'EXPENSE'],
];
const RULES = [{
  code: 'SALE-CASH', eventType: 'SALE_CASH', lines: [
    { accountCodeKey: 'settlement', side: 'DEBIT', amountKey: 'settlement' },
    { accountCodeKey: 'revenue', side: 'CREDIT', amountKey: 'revenue' },
    { accountCodeKey: 'outputTax', side: 'CREDIT', amountKey: 'outputTax', skipIfZero: true },
    { accountCodeKey: 'cogs', side: 'DEBIT', amountKey: 'cogs' },
    { accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory' },
  ],
}, {
  code: 'SALE-RETURN', eventType: 'SALE_RETURN', lines: [
    { accountCodeKey: 'returns', side: 'DEBIT', amountKey: 'net' },
    { accountCodeKey: 'outputTax', side: 'DEBIT', amountKey: 'outputTax', skipIfZero: true },
    { accountCodeKey: 'settlement', side: 'CREDIT', amountKey: 'gross' },
    { accountCodeKey: 'inventory', side: 'DEBIT', amountKey: 'inventory', skipIfZero: true },
    { accountCodeKey: 'cogs', side: 'CREDIT', amountKey: 'cogs', skipIfZero: true },
  ],
}, {
  code: 'ONLINE-ORDER-PREPAID-FULFILLED', eventType: 'ONLINE_ORDER_PREPAID_FULFILLED', lines: [
    { accountCodeKey: 'customerAdvance', side: 'DEBIT', amountKey: 'gross' },
    { accountCodeKey: 'revenue', side: 'CREDIT', amountKey: 'revenue' },
    { accountCodeKey: 'outputTax', side: 'CREDIT', amountKey: 'outputTax', skipIfZero: true },
    { accountCodeKey: 'cogs', side: 'DEBIT', amountKey: 'cogs' },
    { accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory' },
  ],
}, {
  code: 'ORDER-RETURN', eventType: 'ORDER_RETURN', lines: [
    { accountCodeKey: 'returns', side: 'DEBIT', amountKey: 'net' },
    { accountCodeKey: 'outputTax', side: 'DEBIT', amountKey: 'outputTax', skipIfZero: true },
    { accountCodeKey: 'settlement', side: 'CREDIT', amountKey: 'gross' },
    { accountCodeKey: 'inventory', side: 'DEBIT', amountKey: 'inventory', skipIfZero: true },
    { accountCodeKey: 'cogs', side: 'CREDIT', amountKey: 'cogs', skipIfZero: true },
  ],
}, {
  code: 'STOCK-TRANSFER-SHIPPED', eventType: 'STOCK_TRANSFER_SHIPPED', lines: [
    { accountCodeKey: 'debit', side: 'DEBIT', amountKey: 'gross' },
    { accountCodeKey: 'credit', side: 'CREDIT', amountKey: 'gross' },
  ],
}, {
  code: 'STOCK-TRANSFER-RECEIVED', eventType: 'STOCK_TRANSFER_RECEIVED', lines: [
    { accountCodeKey: 'debit', side: 'DEBIT', amountKey: 'gross' },
    { accountCodeKey: 'credit', side: 'CREDIT', amountKey: 'gross' },
  ],
}, {
  code: 'STOCK-OPNAME-ADJUSTMENT', eventType: 'STOCK_OPNAME_ADJUSTMENT', lines: [
    { accountCodeKey: 'inventoryGain', side: 'DEBIT', amountKey: 'inventoryGain' },
    { accountCodeKey: 'gain', side: 'CREDIT', amountKey: 'gain' },
    { accountCodeKey: 'loss', side: 'DEBIT', amountKey: 'loss' },
    { accountCodeKey: 'inventoryLoss', side: 'CREDIT', amountKey: 'inventoryLoss' },
  ],
}, {
  code: 'PRODUCTION-CONSUME', eventType: 'PRODUCTION_CONSUME', lines: [
    { accountCodeKey: 'wip', side: 'DEBIT', amountKey: 'inventory' },
    { accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory' },
  ],
}, {
  code: 'PRODUCTION-COMPLETE', eventType: 'PRODUCTION_COMPLETE', lines: [
    { accountCodeKey: 'inventory', side: 'DEBIT', amountKey: 'inventory' },
    { accountCodeKey: 'wip', side: 'CREDIT', amountKey: 'inventory' },
  ],
}, {
  code: 'ASSET-MAINTENANCE-PARTS', eventType: 'ASSET_MAINTENANCE_PARTS', lines: [
    { accountCodeKey: 'debit', side: 'DEBIT', amountKey: 'gross' },
    { accountCodeKey: 'credit', side: 'CREDIT', amountKey: 'gross' },
  ],
}, {
  code: 'PURCHASE-RETURN', eventType: 'PURCHASE_RETURN', lines: [
    { accountCodeKey: 'payable', side: 'DEBIT', amountKey: 'payableOffset', skipIfZero: true },
    { accountCodeKey: 'supplierReceivable', side: 'DEBIT', amountKey: 'supplierReceivable', skipIfZero: true },
    { accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory' },
    { accountCodeKey: 'inputTax', side: 'CREDIT', amountKey: 'inputTax', skipIfZero: true },
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
  for (const product of [
    { id: BATCHED, sku: 'BATCH-1', name: 'Batch', costPrice: 999, salePrice: 2000, trackBatch: true, trackExpiry: true },
    { id: PLAIN, sku: 'PLAIN-1', name: 'Biasa', costPrice: 500, salePrice: 800, trackBatch: false },
    { id: NO_COST, sku: 'NOCOST-1', name: 'Tanpa Biaya', costPrice: 500, salePrice: 800, trackBatch: true, trackExpiry: true },
    { id: ORDER_PRODUCT, sku: 'ORDER-1', name: 'Pesanan', costPrice: 999, salePrice: 3000, trackBatch: true, trackExpiry: true },
  ]) {
    await prisma.product.create({ data: { ...product, companyId: COMPANY, unit: 'PCS' } });
  }
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: BATCHED, quantity: 10, available: 10 } });
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: PLAIN, quantity: 5, available: 5 } });
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: NO_COST, quantity: 3, available: 3 } });
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, quantity: 10, reserved: 2, available: 8 } });
  await prisma.inventoryBatch.createMany({ data: [
    { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber: 'EARLY', quantity: 5, expiryDate: day(2), createdAt: new Date('2026-01-01T00:00:00Z') },
    { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber: 'LATE', quantity: 5, expiryDate: day(5), createdAt: new Date('2026-01-02T00:00:00Z') },
    { warehouseId: WAREHOUSE, productId: NO_COST, batchNumber: 'NO-STATE', quantity: 3, expiryDate: day(5), createdAt: new Date('2026-01-03T00:00:00Z') },
    { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH', quantity: 10, expiryDate: day(5), createdAt: new Date('2026-01-04T00:00:00Z') },
  ] });
  for (const rule of RULES) {
    await prisma.accountingPostingRule.create({ data: {
      companyId: COMPANY, code: rule.code, version: 1, name: rule.code, eventType: rule.eventType, status: 'ACTIVE', journalLines: rule.lines,
    } });
  }
  await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'inventory.costing', enabled: true, scope: 'BRANCH' } });
  await prisma.costingPolicy.create({ data: {
    companyId: COMPANY, branchId: BRANCH, scopeKey: `branch:${BRANCH}`, method: 'MOVING_AVERAGE', mode: 'ACTIVE',
    status: 'ACTIVE', version: 1, effectiveFrom: new Date('2026-10-20T00:00:00Z'), approvedAt: new Date(),
  } });
  for (const [batchKey, quantity, value] of [['EARLY', 5, '5000'], ['LATE', 5, '10000'], ['', 5, '2500']]) {
    await prisma.inventoryCostState.create({ data: {
      companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE,
      productId: batchKey === '' ? PLAIN : BATCHED, batchKey, method: 'MOVING_AVERAGE',
      quantity, value, averageCost: String(Number(value) / quantity),
    } });
  }
  await prisma.inventoryCostState.create({ data: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE,
    productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
    quantity: 10, value: '5000', averageCost: '500',
  } });
}

async function createPackedOrder() {
  const order = await prisma.order.create({ data: {
    number: 'ORD-COSTING-1', branchId: BRANCH, warehouseId: WAREHOUSE,
    customerName: 'Pembeli Costing', customerPhone: '0812000000', address: 'Ambil di toko',
    fulfillmentType: 'PICKUP', status: 'PACKED',
    subtotal: new Prisma.Decimal(6000), total: new Prisma.Decimal(6000),
    items: { create: [{
      productId: ORDER_PRODUCT, quantity: 2, unitPrice: new Prisma.Decimal(3000),
      unitCost: new Prisma.Decimal(999), subtotal: new Prisma.Decimal(6000),
      netSubtotal: new Prisma.Decimal(6000), taxAmount: new Prisma.Decimal(0),
      grossSubtotal: new Prisma.Decimal(6000),
    }] },
    payments: { create: [{
      number: 'PAY-COSTING-1', method: 'CASH', amount: new Prisma.Decimal(6000),
      status: 'PAID', paidAt: new Date(),
    }] },
  }, include: { items: true } });
  await prisma.shipment.create({ data: {
    number: 'SHP-COSTING-1', orderId: order.id, warehouseId: WAREHOUSE,
    status: 'READY', recipient: { name: 'Pembeli Costing' },
  } });
  return order;
}

const sell = (productId, quantity) => sales.create({ warehouseId: WAREHOUSE, items: [{ productId, quantity }], paymentMethod: 'CASH' }, user);

await seed();

test('two concurrent sales on the same product/layer do not duplicate COGS or layer consumption', async () => {
  const FIXED = new Date('2026-10-24T12:00:00Z');
  const sell = (quantity) => sales.create({ warehouseId: WAREHOUSE, items: [{ productId: BATCHED, quantity }], paymentMethod: 'CASH' }, user, { occurredAt: FIXED });

  const results = await Promise.allSettled([sell(3), sell(3)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2, 'both concurrent sales must succeed');

  const soldIds = results.map((result) => result.value.id);
  assert.equal(new Set(soldIds).size, 2, 'concurrent sales must create distinct sale records');

  const inventory = await prisma.inventory.findUniqueOrThrow({
    where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId: BATCHED } },
  });
  assert.equal(inventory.quantity, 4, 'stock must be decremented exactly once per sold unit');

  const early = await prisma.inventoryBatch.findUniqueOrThrow({
    where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber: 'EARLY' } },
  });
  const late = await prisma.inventoryBatch.findUniqueOrThrow({
    where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: BATCHED, batchNumber: 'LATE' } },
  });
  assert.equal(early.quantity, 0, 'EARLY batch must be fully consumed without duplication');
  assert.equal(late.quantity, 4, 'LATE batch must retain the unconsumed units');

  const events = await prisma.inventoryCostEvent.findMany({
    where: { companyId: COMPANY, productId: BATCHED, eventType: 'ISSUE', sourceType: 'Sale' },
    orderBy: { batchKey: 'asc' },
  });
  assert.equal(events.length, 3, 'FEFO splits must not create duplicate cost events');
  assert.equal(events.reduce((sum, event) => sum + Math.abs(event.quantityDelta), 0), 6, 'cost event quantity must match sold quantity');
  assert.equal(events.reduce((sum, event) => sum + Math.abs(Number(event.valueDelta)), 0), 7000, 'COGS value must not be duplicated');

  const salesRows = await prisma.sale.findMany({ where: { branchId: BRANCH, warehouseId: WAREHOUSE } });
  assert.equal(salesRows.length, 2, 'two distinct sales must be recorded');
  assert.equal(salesRows.reduce((sum, row) => sum + Number(row.costTotal), 0), 7000, 'aggregate sale COGS must match consumed cost');
});

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});
