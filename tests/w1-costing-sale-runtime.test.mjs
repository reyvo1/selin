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
    status: 'ACTIVE', version: 1, effectiveFrom: day(-1), approvedAt: new Date(),
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

test('an ACTIVE sale consumes FEFO batch cost and rewrites Sale/SaleItem COGS from the ledger', async () => {
  const created = await sell(BATCHED, 6);
  assert.equal(Number(created.costTotal), 7000, '5 x 1000 + 1 x 2000 dari state batch');
  assert.equal(Number(created.items[0].unitCost), 1166.666667, 'unitCost line adalah biaya rata-rata tertimbang');

  const events = await prisma.inventoryCostEvent.findMany({ where: { sourceType: 'Sale', sourceId: created.id }, orderBy: { batchKey: 'asc' } });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => [event.batchKey, event.quantityDelta, Number(event.valueDelta)]), [
    ['EARLY', -5, -5000], ['LATE', -1, -2000],
  ]);

  const early = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: BATCHED, batchKey: 'EARLY', method: 'MOVING_AVERAGE',
  } } });
  const late = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: BATCHED, batchKey: 'LATE', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(early.quantity, 0);
  assert.equal(Number(early.value), 0);
  assert.equal(late.quantity, 4);
  assert.equal(Number(late.value), 8000);

  const event = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: created.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: event.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  const cogs = journal.lines.find((line) => line.account.code === '5101');
  const inventory = journal.lines.find((line) => line.account.code === '1301');
  assert.equal(Number(cogs.debit), 7000, 'jurnal HPP memakai biaya ledger, bukan Product.costPrice');
  assert.equal(Number(inventory.credit), 7000);
});

test('a non-batch product posts one ISSUE against the empty-batch sentinel', async () => {
  const created = await sell(PLAIN, 2);
  assert.equal(Number(created.costTotal), 1000);
  const event = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'Sale', sourceId: created.id } });
  assert.equal(event.batchKey, '');
  assert.equal(event.quantityDelta, -2);
  assert.equal(Number(event.valueDelta), -1000);
});

test('ACTIVE rejects an uncosted issue atomically and leaves stock untouched', async () => {
  const salesBefore = await prisma.sale.count();
  await assert.rejects(() => sell(NO_COST, 1), /Costing ACTIVE menolak pengeluaran 1 unit tanpa biaya/);
  assert.equal(await prisma.sale.count(), salesBefore);
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId: NO_COST } } })).quantity, 3);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: NO_COST, batchNumber: 'NO-STATE' } } })).quantity, 3);
});

test('an ACTIVE sale return restores the original batch cost and journals COGS reversal', async () => {
  const created = await sell(BATCHED, 2);
  const original = created.items[0];
  assert.equal(Number(created.costTotal), 4000, '2 x 2000 dari batch LATE');

  const saleReturn = await prisma.saleReturn.create({
    data: {
      number: 'SRT-COSTING-1',
      saleId: created.id,
      warehouseId: WAREHOUSE,
      status: 'REQUESTED',
      reason: 'uji costing retur',
      refundMethod: 'ORIGINAL',
      refundAmount: new Prisma.Decimal(4000),
      createdById: USER,
      items: { create: [{
        productId: BATCHED,
        quantity: 2,
        condition: 'GOOD',
        restock: true,
        unitAmount: original.unitPrice,
        unitCost: original.unitCost,
        netAmount: new Prisma.Decimal(4000),
        taxAmount: new Prisma.Decimal(0),
        grossAmount: new Prisma.Decimal(4000),
        metadata: { saleItemId: original.id },
      }] },
    },
    include: { items: true },
  });

  const confirmed = await returns.confirmSaleReturn(saleReturn.id, {}, user);
  assert.equal(confirmed.status, 'COMPLETED');

  const events = await prisma.inventoryCostEvent.findMany({ where: { sourceType: 'SaleReturn', sourceId: saleReturn.id } });
  assert.equal(events.length, 1);
  assert.equal(events[0].batchKey, 'LATE');
  assert.equal(events[0].quantityDelta, 2);
  assert.equal(Number(events[0].valueDelta), 4000);

  const late = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: BATCHED, batchKey: 'LATE', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(late.quantity, 4);
  assert.equal(Number(late.value), 8000);

  const event = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: confirmed.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: event.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(journal.lines.find((line) => line.account.code === '5101').credit), 4000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1301').debit), 4000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '4102').debit), 4000);
});

test('an ACTIVE purchase return credits inventory at moving average and posts the price variance', async () => {
  const supplierId = 'sup-costing';
  const purchaseOrderId = 'po-costing';
  const purchaseOrderItemId = 'poi-costing';
  const receiptId = 'gr-costing';
  const receiptItemId = 'gri-costing';
  const returnId = 'pr-costing';
  await prisma.supplier.create({ data: { id: supplierId, companyId: COMPANY, code: 'SUP-COSTING', name: 'Supplier Costing' } });
  await prisma.purchaseOrder.create({ data: {
    id: purchaseOrderId, number: 'PO-COSTING-1', supplierId, warehouseId: WAREHOUSE, status: 'APPROVED',
    subtotal: new Prisma.Decimal(7500), total: new Prisma.Decimal(7500),
  } });
  await prisma.purchaseOrderItem.create({ data: {
    id: purchaseOrderItemId, purchaseOrderId, productId: BATCHED, orderedQty: 5, receivedQty: 5,
    unitCost: new Prisma.Decimal(1500), subtotal: new Prisma.Decimal(7500),
  } });
  await prisma.goodsReceipt.create({ data: {
    id: receiptId, number: 'GR-COSTING-1', purchaseOrderId, supplierId, warehouseId: WAREHOUSE,
    operationalStatus: 'CONFIRMED', confirmedAt: day(-1), grossTotal: new Prisma.Decimal(7500),
    items: { create: [{
      id: receiptItemId, purchaseOrderItemId, productId: BATCHED, quantityReceived: 5, acceptedQty: 5,
      unitCost: new Prisma.Decimal(1500), subtotal: new Prisma.Decimal(7500), batchNumber: 'LATE',
    }] },
  } });
  await prisma.purchaseReturn.create({ data: {
    id: returnId, number: 'PR-COSTING-1', goodsReceiptId: receiptId, supplierId, warehouseId: WAREHOUSE,
    status: 'REQUESTED', reason: 'uji costing retur supplier', amount: new Prisma.Decimal(1500),
    createdById: USER,
    items: { create: [{
      productId: BATCHED, quantity: 1, unitCost: new Prisma.Decimal(1500),
      netAmount: new Prisma.Decimal(1500), taxAmount: new Prisma.Decimal(0), grossAmount: new Prisma.Decimal(1500),
      metadata: { goodsReceiptItemId: receiptItemId },
    }] },
  } });

  const confirmed = await returns.confirmPurchaseReturn(returnId, {}, user);
  assert.equal(confirmed.status, 'COMPLETED');

  const event = await prisma.inventoryCostEvent.findFirstOrThrow({
    where: { sourceType: 'PurchaseReturn', sourceId: returnId },
  });
  assert.equal(event.eventType, 'PURCHASE_RETURN');
  assert.equal(event.batchKey, 'LATE');
  assert.equal(event.quantityDelta, -1);
  assert.equal(Number(event.valueDelta), -2000, 'inventory keluar pada moving average 2000');

  const late = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: BATCHED, batchKey: 'LATE', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(late.quantity, 3);
  assert.equal(Number(late.value), 6000);

  const accountingEvent = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: confirmed.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: accountingEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(journal.lines.find((line) => line.account.code === '2101').debit), 1500);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1301').credit), 2000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '5103').debit), 500, 'harga beli di bawah carrying value adalah kerugian');
  assert.equal(journal.lines.find((line) => line.account.code === '4203'), undefined);
});

let shippedOrderId;
let shippedOrderItemId;

test('an ACTIVE order shipment issues FEFO batch cost and rewrites OrderItem.unitCost', async () => {
  const order = await createPackedOrder();
  shippedOrderId = order.id;
  shippedOrderItemId = order.items[0].id;

  const shipped = await orders.ship(order.id, {}, user);
  assert.equal(shipped.status, 'SHIPPED');

  const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: order.items[0].id } });
  assert.equal(Number(item.unitCost), 500, '2 unit x 500 dari state batch');

  const event = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'Order', sourceId: order.id } });
  assert.equal(event.eventType, 'ISSUE');
  assert.equal(event.batchKey, 'ORDER-BATCH');
  assert.equal(event.quantityDelta, -2);
  assert.equal(Number(event.valueDelta), -1000);

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(state.quantity, 8);
  assert.equal(Number(state.value), 4000);

  const inventory = await prisma.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT } } });
  assert.equal(inventory.quantity, 8);
  assert.equal(inventory.reserved, 0);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } })).quantity, 8);

  const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { referenceType: 'Order', referenceId: order.id } });
  assert.ok(movement.occurredAt);

  const accountingEvent = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: shipped.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: accountingEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(journal.lines.find((line) => line.account.code === '5101').debit), 1000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1301').credit), 1000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '2105').debit), 6000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '4101').credit), 6000);
});

test('an ACTIVE order return restores the original batch cost and journals COGS reversal', async () => {
  const orderItem = await prisma.orderItem.findUniqueOrThrow({ where: { id: shippedOrderItemId } });
  const orderReturn = await prisma.orderReturn.create({ data: {
    number: 'ORT-COSTING-1', companyId: COMPANY, branchId: BRANCH, orderId: shippedOrderId,
    warehouseId: WAREHOUSE, status: 'INSPECTION', refundMethod: 'CASH',
    refundAmount: new Prisma.Decimal(3000),
    items: { create: [{
      orderItemId: orderItem.id, productId: ORDER_PRODUCT, quantity: 1,
      condition: 'GOOD', restock: true, unitAmount: new Prisma.Decimal(3000),
      unitCost: orderItem.unitCost, netAmount: new Prisma.Decimal(3000),
      taxAmount: new Prisma.Decimal(0), grossAmount: new Prisma.Decimal(3000),
    }] },
  }, include: { items: true } });

  const inspection = await prisma.operationalInspection.create({ data: {
    companyId: COMPANY, branchId: BRANCH, number: 'INS-ORT-COSTING-1', type: 'RETURN_INBOUND',
    sourceType: 'OrderReturn', sourceId: orderReturn.id, status: 'APPROVED',
    approvedAt: new Date(),
    results: { create: [{
      code: `ORDER_RETURN_ITEM:${orderReturn.items[0].id}`, label: 'Pesanan',
      result: 'PASS', productId: ORDER_PRODUCT, expectedQty: 1, scannedQty: 1,
      acceptedQty: 1, rejectedQty: 0, damagedQty: 0,
    }] },
  } });
  await prisma.orderReturn.update({ where: { id: orderReturn.id }, data: { inspectionId: inspection.id } });

  const confirmed = await returns.confirmOrderReturn(orderReturn.id, {}, user);
  assert.equal(confirmed.status, 'COMPLETED');

  const event = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'OrderReturn', sourceId: orderReturn.id } });
  assert.equal(event.eventType, 'SALE_RETURN');
  assert.equal(event.batchKey, 'ORDER-BATCH');
  assert.equal(event.quantityDelta, 1);
  assert.equal(Number(event.valueDelta), 500);

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(state.quantity, 9);
  assert.equal(Number(state.value), 4500);

  const inventory = await prisma.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT } } });
  assert.equal(inventory.quantity, 9);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } })).quantity, 9);

  const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { referenceType: 'OrderReturn', referenceId: orderReturn.id } });
  assert.ok(movement.occurredAt);

  const accountingEvent = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: confirmed.accountingEventId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: accountingEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(journal.lines.find((line) => line.account.code === '4102').debit), 3000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1101').credit), 3000);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1301').debit), 500);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '5101').credit), 500);
});

test('an ACTIVE stock transfer moves cost from source ISSUE to destination RECEIPT without using Product.costPrice', async () => {
  const destinationWarehouseId = 'wh-2';
  await prisma.warehouse.create({ data: { id: destinationWarehouseId, code: 'W2', name: 'Gudang 2', branchId: BRANCH, isActive: true } });

  const transfer = await advanced.createTransfer({
    sourceWarehouseId: WAREHOUSE,
    destinationWarehouseId,
    items: [{ productId: ORDER_PRODUCT, quantity: 1, batchNumber: 'ORDER-BATCH' }],
  }, user);
  assert.equal(transfer.status, 'REQUESTED');
  await advanced.approveTransfer(transfer.id, user);
  const shipped = await advanced.shipTransfer(transfer.id, user);
  assert.equal(shipped.status, 'SHIPPED');

  const issue = await prisma.inventoryCostEvent.findFirstOrThrow({
    where: { sourceType: 'StockTransfer', sourceId: transfer.id, eventType: 'ISSUE' },
  });
  assert.equal(issue.sourceLineKey, transfer.items[0].id);
  assert.equal(issue.quantityDelta, -1);
  assert.equal(Number(issue.valueDelta), -500);

  const sourceState = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(sourceState.quantity, 8);
  assert.equal(Number(sourceState.value), 4000);

  const shippedEvent = await prisma.accountingEvent.findFirstOrThrow({
    where: { eventType: 'STOCK_TRANSFER_SHIPPED', sourceId: transfer.id },
    include: { postings: true },
  });
  const shippedJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: shippedEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(shippedJournal.lines.find((line) => line.account.code === '1302').debit), 500);
  assert.equal(Number(shippedJournal.lines.find((line) => line.account.code === '1301').credit), 500);

  const received = await advanced.receiveTransfer(transfer.id, { items: [{ transferItemId: transfer.items[0].id, receivedQty: 1 }] }, user);
  assert.equal(received.status, 'RECEIVED');

  const receipt = await prisma.inventoryCostEvent.findFirstOrThrow({
    where: { sourceType: 'StockTransfer', sourceId: transfer.id, eventType: 'RECEIPT' },
  });
  assert.equal(receipt.quantityDelta, 1);
  assert.equal(Number(receipt.valueDelta), 500);

  const destinationState = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: destinationWarehouseId, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(destinationState.quantity, 1);
  assert.equal(Number(destinationState.value), 500);

  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: destinationWarehouseId, productId: ORDER_PRODUCT } } })).quantity, 1);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: destinationWarehouseId, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } })).quantity, 1);

  const receivedEvent = await prisma.accountingEvent.findFirstOrThrow({
    where: { eventType: 'STOCK_TRANSFER_RECEIVED', sourceId: { startsWith: `${transfer.id}:` } },
    include: { postings: true },
  });
  const receivedJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: receivedEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(receivedJournal.lines.find((line) => line.account.code === '1301').debit), 500);
  assert.equal(Number(receivedJournal.lines.find((line) => line.account.code === '1302').credit), 500);
});

test('an ACTIVE stock opname values gains and losses at the current ledger cost', async () => {
  const countAll = (opname, targetItemId, targetQty) => ({
    items: opname.items.map((item) => ({ opnameItemId: item.id, countedQty: item.id === targetItemId ? targetQty : item.systemQty })),
  });

  const opnameWarehouseId = 'wh-2';
  const gainOpname = await advanced.createOpname({ warehouseId: opnameWarehouseId }, user);
  const gainItem = gainOpname.items.find((item) => item.productId === ORDER_PRODUCT && item.batchNumber === 'ORDER-BATCH');
  assert.ok(gainItem);
  await advanced.countOpname(gainOpname.id, countAll(gainOpname, gainItem.id, gainItem.systemQty + 1), user);
  await advanced.submitOpname(gainOpname.id, user);
  await advanced.completeOpname(gainOpname.id, user);

  const gainEvent = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'StockOpname', sourceId: gainOpname.id, eventType: 'RECEIPT' } });
  assert.equal(gainEvent.quantityDelta, 1);
  assert.equal(Number(gainEvent.valueDelta), 500);
  const afterGain = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: opnameWarehouseId, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(afterGain.quantity, 2);
  assert.equal(Number(afterGain.value), 1000);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: opnameWarehouseId, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } })).quantity, 2);

  const gainJournal = await prisma.journalEntry.findFirstOrThrow({ where: { lines: { some: { account: { code: '4201' } } } }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(gainJournal.lines.find((line) => line.account.code === '1301').debit), 500);
  assert.equal(Number(gainJournal.lines.find((line) => line.account.code === '4201').credit), 500);

  const lossOpname = await advanced.createOpname({ warehouseId: opnameWarehouseId }, user);
  const lossItem = lossOpname.items.find((item) => item.productId === ORDER_PRODUCT && item.batchNumber === 'ORDER-BATCH');
  assert.ok(lossItem);
  await advanced.countOpname(lossOpname.id, countAll(lossOpname, lossItem.id, lossItem.systemQty - 1), user);
  await advanced.submitOpname(lossOpname.id, user);
  await advanced.completeOpname(lossOpname.id, user);

  const lossEvent = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'StockOpname', sourceId: lossOpname.id, eventType: 'ISSUE' } });
  assert.equal(lossEvent.quantityDelta, -1);
  assert.equal(Number(lossEvent.valueDelta), -500);
  const afterLoss = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: opnameWarehouseId, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(afterLoss.quantity, 1);
  assert.equal(Number(afterLoss.value), 500);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: opnameWarehouseId, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } })).quantity, 1);

  const lossJournal = await prisma.journalEntry.findFirstOrThrow({ where: { lines: { some: { account: { code: '5102' } } } }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(lossJournal.lines.find((line) => line.account.code === '5102').debit), 500);
  assert.equal(Number(lossJournal.lines.find((line) => line.account.code === '1301').credit), 500);
});

test('an ACTIVE production order consumes component ledger cost and receives output at that cost', async () => {
  const componentId = 'p-component';
  const outputId = 'p-output';
  const recipeId = 'recipe-1';
  const orderId = 'prod-1';
  await prisma.product.createMany({ data: [
    { id: componentId, companyId: COMPANY, sku: 'COMP-1', name: 'Komponen', unit: 'PCS', costPrice: 999, salePrice: 1500 },
    { id: outputId, companyId: COMPANY, sku: 'OUT-1', name: 'Barang Jadi', unit: 'PCS', costPrice: 777, salePrice: 2500 },
  ] });
  await prisma.inventory.create({ data: { warehouseId: WAREHOUSE, productId: componentId, quantity: 2, available: 2 } });
  await prisma.inventoryCostState.create({ data: { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: componentId, batchKey: '', method: 'MOVING_AVERAGE', quantity: 2, value: 1000 } });
  await prisma.productionRecipe.create({ data: {
    id: recipeId, companyId: COMPANY, code: 'RCP-1', name: 'Resep', outputProductId: outputId, outputQtyPerBatch: 1, version: 1,
    items: { create: [{ componentProductId: componentId, quantityPerBatch: 1, wastePct: 0 }] },
  } });
  await prisma.productionOrder.create({ data: {
    id: orderId, companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, recipeId, createdById: USER,
    number: 'PROD-1', status: 'IN_PROGRESS', batchCount: 1, plannedOutputQty: 1,
    components: { create: [{ productId: componentId, plannedQty: 1 }] },
  } });

  const completed = await manufacturing.complete(orderId, { actualOutputQty: 1 }, user);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(Number(completed.totalCost), 500);

  const component = await prisma.productionOrderComponent.findFirstOrThrow({ where: { orderId } });
  assert.equal(Number(component.unitCost), 500);
  assert.equal(Number(component.totalCost), 500);

  const issue = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'ProductionOrder', sourceId: orderId, eventType: 'ISSUE' } });
  assert.equal(issue.quantityDelta, -1);
  assert.equal(Number(issue.valueDelta), -500);
  const receipt = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'ProductionOrder', sourceId: orderId, eventType: 'RECEIPT' } });
  assert.equal(receipt.quantityDelta, 1);
  assert.equal(Number(receipt.valueDelta), 500);

  const outputState = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: outputId, batchKey: '', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(outputState.quantity, 1);
  assert.equal(Number(outputState.value), 500);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: outputId } })).costPrice.toNumber(), 777);

  const consumeEvent = await prisma.accountingEvent.findFirstOrThrow({ where: { eventType: 'PRODUCTION_CONSUME', sourceId: orderId }, include: { postings: true } });
  const consumeJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: consumeEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(consumeJournal.lines.find((line) => line.account.code === '1303').debit), 500);
  assert.equal(Number(consumeJournal.lines.find((line) => line.account.code === '1301').credit), 500);
  const outputEvent = await prisma.accountingEvent.findFirstOrThrow({ where: { eventType: 'PRODUCTION_COMPLETE', sourceId: orderId }, include: { postings: true } });
  const outputJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: outputEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(outputJournal.lines.find((line) => line.account.code === '1301').debit), 500);
  assert.equal(Number(outputJournal.lines.find((line) => line.account.code === '1303').credit), 500);
});

test('an ACTIVE maintenance work order consumes part ledger cost for the parts journal', async () => {
  const categoryId = 'cat-1';
  const assetId = 'asset-1';
  const workId = 'mwo-1';
  await prisma.assetCategory.create({ data: { id: categoryId, companyId: COMPANY, code: 'CAT-1', name: 'Mesin', assetType: 'MOVABLE', maintenanceExpenseCode: '5203' } });
  await prisma.asset.create({ data: { id: assetId, companyId: COMPANY, branchId: BRANCH, categoryId, code: 'AST-1', name: 'Mesin', assetType: 'MOVABLE', status: 'ACTIVE' } });
  await prisma.maintenanceWorkOrder.create({ data: { id: workId, companyId: COMPANY, branchId: BRANCH, number: 'MWO-1', assetId, status: 'IN_PROGRESS', maintenanceType: 'PREVENTIVE' } });
  const batch = await prisma.inventoryBatch.findUniqueOrThrow({ where: { warehouseId_productId_batchNumber: { warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchNumber: 'ORDER-BATCH' } } });

  const completed = await assets.completeMaintenance(workId, {
    actualCost: 0,
    completedAt: new Date().toISOString(),
    parts: [{ warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, quantity: 1, batchId: batch.id }],
  }, user);
  assert.equal(completed.status, 'COMPLETED');

  const issue = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { sourceType: 'MaintenanceWorkOrder', sourceId: workId, eventType: 'ISSUE' } });
  assert.equal(issue.quantityDelta, -1);
  assert.equal(Number(issue.valueDelta), -500);
  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: ORDER_PRODUCT, batchKey: 'ORDER-BATCH', method: 'MOVING_AVERAGE',
  } } });
  assert.equal(state.quantity, 7);
  assert.equal(Number(state.value), 3500);
  assert.equal((await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } })).quantity, 7);

  const partsEvent = await prisma.accountingEvent.findFirstOrThrow({ where: { eventType: 'ASSET_MAINTENANCE_PARTS', sourceId: workId }, include: { postings: true } });
  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: partsEvent.postings[0].journalEntryId }, include: { lines: { include: { account: true } } } });
  assert.equal(Number(journal.lines.find((line) => line.account.code === '5203').debit), 500);
  assert.equal(Number(journal.lines.find((line) => line.account.code === '1301').credit), 500);
});


test('costing policy API stores a DRAFT, activates a forward-effective policy, and values cost states', async () => {
  await prisma.user.create({ data: { id: approver.sub, name: 'Approver', email: approver.email, passwordHash: 'x', isActive: true } });
  const draft = await costingPolicies.create(user, { method: 'MOVING_AVERAGE', mode: 'ACTIVE', effectiveFrom: day(2).toISOString() });
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.version, 2);

  await assert.rejects(() => costingPolicies.activate(user, draft.id), /approver yang berbeda/);
  const activated = await costingPolicies.activate(approver, draft.id);
  assert.equal(activated.status, 'ACTIVE');
  assert.equal(activated.approvedBy, approver.sub);

  const listed = await costingPolicies.list(user, { limit: '10' });
  assert.ok(listed.items.some((policy) => policy.id === draft.id));

  const valuation = await costingPolicies.valuation(user, {});
  assert.ok(valuation.totals.quantity > 0);
  assert.ok(Array.isArray(valuation.byWarehouse));
  assert.ok(valuation.byWarehouse.every((row) => typeof row.value === 'string'));
});

test('costing policy API rejects activation of a backdated policy', async () => {
  const draft = await costingPolicies.create(user, { method: 'MOVING_AVERAGE', mode: 'SHADOW', effectiveFrom: day(-2).toISOString() });
  await assert.rejects(() => costingPolicies.activate(approver, draft.id), /masa lalu/);
});


test('costing layers and reconciliation are tenant-scoped and expose quantity/value differences', async () => {
  const PRODUCT = 'p-report';
  const MISMATCH = 'p-report-mismatch';
  await prisma.product.createMany({ data: [
    { id: PRODUCT, companyId: COMPANY, sku: 'RPT-1', name: 'Report', costPrice: 100, salePrice: 200, unit: 'PCS' },
    { id: MISMATCH, companyId: COMPANY, sku: 'RPT-2', name: 'Report Mismatch', costPrice: 100, salePrice: 200, unit: 'PCS' },
  ] });
  await prisma.inventory.createMany({ data: [
    { warehouseId: WAREHOUSE, productId: PRODUCT, quantity: 4, available: 4 },
    { warehouseId: WAREHOUSE, productId: MISMATCH, quantity: 3, available: 3 },
  ] });
  await prisma.inventoryCostState.createMany({ data: [
    { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: PRODUCT, batchKey: '', method: 'MOVING_AVERAGE', quantity: 4, value: 400, averageCost: 100 },
    { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: MISMATCH, batchKey: '', method: 'MOVING_AVERAGE', quantity: 2, value: 200, averageCost: 100 },
  ] });
  await prisma.inventoryCostLayer.create({ data: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: PRODUCT, batchKey: '', method: 'MOVING_AVERAGE',
    sourceEventId: 'report-layer-event', receivedAt: day(-1), originalQty: 4, remainingQty: 4,
    unitCost: 100, originalValue: 400, remainingValue: 400, status: 'OPEN',
  } });

  const layers = await costingReports.layers(user, { productId: PRODUCT });
  assert.equal(layers.items.length, 1);
  assert.equal(layers.items[0].remainingQty, 4);
  assert.equal(layers.items[0].remainingValue, '400.00');

  const matched = await costingReports.reconciliation(user, { productId: PRODUCT });
  assert.equal(matched.totals.stateQuantity, 4);
  assert.equal(matched.totals.inventoryQuantity, 4);
  assert.equal(matched.totals.quantityDifference, 0);
  assert.equal(matched.totals.matched, true);
  assert.equal(matched.byWarehouse[0].valueDifference, '0.00');

  const mismatch = await costingReports.reconciliation(user, { productId: MISMATCH, onlyDifferences: 'true' });
  assert.equal(mismatch.byWarehouse.length, 1);
  assert.equal(mismatch.byWarehouse[0].quantityDifference, -1);
  assert.equal(mismatch.byWarehouse[0].matched, false);

  const otherBranch = await costingReports.reconciliation({ ...user, branchId: 'br-other' }, {});
  assert.equal(otherBranch.byWarehouse.length, 0);
  assert.equal(otherBranch.totals.stateQuantity, 0);
});
