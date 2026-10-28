import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-costing-fifo-'));
const DB = path.join(TMP, 'costing-fifo.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { InventoryCostingService } = await load('apps/api/src/inventory/costing.service.ts', opts);
const { InventoryCostingPolicyService } = await load('apps/api/src/inventory/costing-policy.service.ts', opts);
const { InventoryCostingReportService } = await load('apps/api/src/inventory/costing-report.service.ts', opts);
const { InventoryCostingRebuildService } = await load('apps/api/src/inventory/costing-rebuild.service.ts', opts);
const { serializableTx } = await load('apps/api/src/common/serializable-tx.ts', opts);

const costing = new InventoryCostingService();
const policies = new InventoryCostingPolicyService(prisma);
const reports = new InventoryCostingReportService(prisma);
const rebuilds = new InventoryCostingRebuildService(prisma);

const COMPANY = 'acme';
const BRANCH = 'br-fifo';
const WAREHOUSE = 'wh-fifo';
const USER = 'u-fifo';
const APPROVER = 'u-fifo-approver';
const user = { sub: USER, companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const approver = { ...user, sub: APPROVER, roles: ['FINANCE'] };
const at = (day) => new Date(`2026-02-${String(day).padStart(2, '0')}T00:00:00Z`);

const source = (id) => ({
  sourceType: 'TEST',
  sourceId: id,
  sourceLineKey: '',
  operationKey: `op-${id}`,
  payloadHash: `hash-${id}`,
  occurredAt: at(1),
});

await prisma.company.create({ data: { id: COMPANY, name: 'Acme', slug: 'acme-fifo', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: USER, name: 'FIFO User', email: 'fifo@test', passwordHash: 'x', isActive: true },
  { id: APPROVER, name: 'FIFO Approver', email: 'fifo-approver@test', passwordHash: 'x', isActive: true },
] });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BRF', name: 'Cabang FIFO', isActive: true } });
await prisma.warehouse.create({ data: { id: WAREHOUSE, code: 'WF', name: 'Gudang FIFO', branchId: BRANCH, isActive: true } });
for (const [id, sku] of [['p-fifo', 'FIFO-1'], ['p-lifo', 'LIFO-1'], ['p-short', 'SHORT-1'], ['p-shadow', 'SHADOW-1'], ['p-backfill', 'BACKFILL-1']]) {
  await prisma.product.create({ data: { id, companyId: COMPANY, sku, name: sku, costPrice: 250, salePrice: 300, unit: 'PCS' } });
}
await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'inventory.costing', enabled: true, scope: 'BRANCH' } });
await prisma.costingPolicy.create({ data: {
  companyId: COMPANY, branchId: BRANCH, scopeKey: `branch:${BRANCH}`, method: 'FIFO', mode: 'ACTIVE',
  status: 'ACTIVE', version: 1, effectiveFrom: at(1), approvedAt: at(1), approvedBy: APPROVER,
} });

test('FIFO consumes the oldest layer and preserves layer/state value', async () => {
  const first = await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('fifo-r1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 10, totalValue: '1000', occurredAt: at(1),
  }));
  assert.equal(first.cost.toFixed(2), '1000.00');
  const second = await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('fifo-r2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 10, totalValue: '2000', occurredAt: at(2),
  }));
  assert.equal(second.cost.toFixed(2), '2000.00');

  const preview = await prisma.$transaction((tx) => costing.previewIssue(tx,
    { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo' }, at(3), 15));
  assert.equal(preview.cost.toFixed(2), '2000.00');
  assert.equal(preview.uncostedQuantity, 0);

  const issue = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('fifo-i1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 15, occurredAt: at(3),
  }));
  assert.equal(issue.cost.toFixed(2), '2000.00');
  assert.equal(issue.unitCost.toFixed(6), '133.333333');
  assert.equal(issue.event.balanceQuantity, 5);
  assert.equal(issue.event.balanceValue.toFixed(2), '1000.00');
  assert.equal(issue.uncostedQuantity, 0);

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo', batchKey: '', method: 'FIFO',
  } } });
  assert.equal(state.quantity, 5);
  assert.equal(state.value.toFixed(2), '1000.00');
  assert.equal(state.averageCost.toFixed(6), '200.000000');

  const layers = await prisma.inventoryCostLayer.findMany({
    where: { companyId: COMPANY, warehouseId: WAREHOUSE, productId: 'p-fifo' },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
  });
  assert.equal(layers.length, 2);
  assert.equal(layers[0].status, 'CONSUMED');
  assert.equal(layers[0].remainingQty, 0);
  assert.equal(layers[0].remainingValue.toFixed(2), '0.00');
  assert.equal(layers[1].status, 'OPEN');
  assert.equal(layers[1].remainingQty, 5);
  assert.equal(layers[1].remainingValue.toFixed(2), '1000.00');
  const consumptions = await prisma.inventoryCostConsumption.findMany({ where: { companyId: COMPANY } });
  assert.equal(consumptions.length, 2);
  assert.equal(consumptions.reduce((sum, row) => sum + row.quantity, 0), 15);
  assert.equal(consumptions.reduce((sum, row) => sum + Number(row.amount), 0), 2000);

  const replay = await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('fifo-r1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 10, totalValue: '1000', occurredAt: at(1),
  }));
  assert.equal(replay.event.id, first.event.id);
  assert.equal(await prisma.inventoryCostLayer.count({ where: { companyId: COMPANY, productId: 'p-fifo' } }), 2);

  const final = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('fifo-i2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 5, occurredAt: at(4),
  }));
  assert.equal(final.cost.toFixed(2), '1000.00');

  const issueReplay = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('fifo-i2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo',
    quantity: 5, occurredAt: at(4),
  }));
  assert.equal(issueReplay.event.id, final.event.id);
  assert.equal(await prisma.inventoryCostConsumption.count({ where: { eventId: final.event.id } }), 1);

  const finalState = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-fifo', batchKey: '', method: 'FIFO',
  } } });
  assert.equal(finalState.quantity, 0);
  assert.equal(finalState.value.toFixed(2), '0.00');
});

test('LIFO consumes the newest layer first', async () => {
  const LIFO_BRANCH = 'br-lifo';
  const LIFO_WAREHOUSE = 'wh-lifo';
  await prisma.branch.create({ data: { id: LIFO_BRANCH, companyId: COMPANY, code: 'BRL', name: 'Cabang LIFO', isActive: true } });
  await prisma.warehouse.create({ data: { id: LIFO_WAREHOUSE, code: 'WL', name: 'Gudang LIFO', branchId: LIFO_BRANCH, isActive: true } });
  await prisma.product.create({ data: { id: 'p-lifo-only', companyId: COMPANY, sku: 'LIFO-ONLY', name: 'LIFO Only', costPrice: 250, salePrice: 300, unit: 'PCS' } });
  await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: LIFO_BRANCH, key: 'inventory.costing', enabled: true, scope: 'BRANCH' } });
  await prisma.costingPolicy.create({ data: {
    companyId: COMPANY, branchId: LIFO_BRANCH, scopeKey: `branch:${LIFO_BRANCH}`, method: 'LIFO', mode: 'ACTIVE',
    status: 'ACTIVE', version: 1, effectiveFrom: at(1), approvedAt: at(1), approvedBy: APPROVER,
  } });
  await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('lifo-r1'), companyId: COMPANY, branchId: LIFO_BRANCH, warehouseId: LIFO_WAREHOUSE, productId: 'p-lifo-only',
    quantity: 10, totalValue: '1000', occurredAt: at(1),
  }));
  await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('lifo-r2'), companyId: COMPANY, branchId: LIFO_BRANCH, warehouseId: LIFO_WAREHOUSE, productId: 'p-lifo-only',
    quantity: 10, totalValue: '2000', occurredAt: at(2),
  }));
  const issue = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('lifo-i1'), companyId: COMPANY, branchId: LIFO_BRANCH, warehouseId: LIFO_WAREHOUSE, productId: 'p-lifo-only',
    quantity: 15, occurredAt: at(3),
  }));
  assert.equal(issue.cost.toFixed(2), '2500.00');
  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: LIFO_BRANCH, warehouseId: LIFO_WAREHOUSE, productId: 'p-lifo-only', batchKey: '', method: 'LIFO',
  } } });
  assert.equal(state.quantity, 5);
  assert.equal(state.value.toFixed(2), '500.00');
  const layers = await prisma.inventoryCostLayer.findMany({ where: { companyId: COMPANY, productId: 'p-lifo-only' }, orderBy: [{ receivedAt: 'asc' }] });
  assert.equal(layers[0].remainingQty, 5);
  assert.equal(layers[0].remainingValue.toFixed(2), '500.00');
  assert.equal(layers[1].status, 'CONSUMED');
});

test('FIFO consumption stays index-backed and bounded on a large open-layer set', async () => {
  const productId = 'p-fifo-volume';
  await prisma.product.create({ data: { id: productId, companyId: COMPANY, sku: 'FIFO-VOL', name: 'FIFO Volume', costPrice: 100, salePrice: 200, unit: 'PCS' } });
  const base = Date.UTC(2026, 1, 1);
  await prisma.inventoryCostState.create({ data: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId, batchKey: '', method: 'FIFO',
    quantity: 2000, value: 200000, averageCost: 100, version: 0,
  } });
  await prisma.inventoryCostLayer.createMany({ data: Array.from({ length: 2000 }, (_, index) => ({
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId, batchKey: '', method: 'FIFO',
    sourceEventId: `volume-event-${index}`, receivedAt: new Date(base + index * 1000),
    originalQty: 1, remainingQty: 1, unitCost: 100, originalValue: 100, remainingValue: 100, status: 'OPEN',
  })) });

  const plan = await prisma.$queryRawUnsafe(
    'EXPLAIN QUERY PLAN SELECT "id" FROM "InventoryCostLayer" WHERE "companyId" = ? AND "branchId" = ? AND "warehouseId" = ? AND "productId" = ? AND "batchKey" = ? AND "method" = ? AND "status" = ? AND "remainingQty" > 0 ORDER BY "receivedAt" ASC, "id" ASC',
    COMPANY, BRANCH, WAREHOUSE, productId, '', 'FIFO', 'OPEN',
  );
  const planDetails = plan.map((row) => String(row.detail)).join('\n');
  assert.match(planDetails, /USING INDEX/);
  assert.doesNotMatch(planDetails, /SCAN "InventoryCostLayer"/);

  const started = performance.now();
  const issue = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('volume-i1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 500, occurredAt: new Date(base + 3000 * 1000),
  }));
  const elapsed = performance.now() - started;
  assert.equal(issue.cost.toFixed(2), '50000.00');
  assert.equal(issue.event.balanceQuantity, 1500);
  assert.ok(elapsed < 5000, `FIFO issue on 2.000 layers took ${elapsed.toFixed(1)}ms`);
});

test('purchase return consumes the originating receipt layer before FIFO order', async () => {
  const productId = 'p-origin-return';
  await prisma.product.create({ data: { id: productId, companyId: COMPANY, sku: 'ORIGIN-1', name: 'Origin Return', costPrice: 250, salePrice: 300, unit: 'PCS' } });
  const first = await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('origin-r1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 10, totalValue: '1000', occurredAt: at(1),
  }));
  const second = await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('origin-r2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 10, totalValue: '2000', occurredAt: at(2),
  }));

  const preferred = await prisma.$transaction((tx) => costing.recordPurchaseReturn(tx, {
    ...source('origin-pr1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 2, occurredAt: at(3), preferredLayerSourceEventId: second.event.id,
  }));
  assert.equal(preferred.cost.toFixed(2), '400.00');
  assert.equal(preferred.event.balanceQuantity, 18);
  assert.equal(preferred.event.balanceValue.toFixed(2), '2600.00');

  const firstLayer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { sourceEventId: first.event.id } });
  const secondLayer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { sourceEventId: second.event.id } });
  assert.equal(firstLayer.remainingQty, 10);
  assert.equal(secondLayer.remainingQty, 8);
  assert.equal(secondLayer.remainingValue.toFixed(2), '1600.00');

  const fallback = await prisma.$transaction((tx) => costing.recordPurchaseReturn(tx, {
    ...source('origin-pr2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 2, occurredAt: at(4),
  }));
  assert.equal(fallback.cost.toFixed(2), '200.00');
  const afterFallback = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { sourceEventId: first.event.id } });
  assert.equal(afterFallback.remainingQty, 8);
  assert.equal(afterFallback.remainingValue.toFixed(2), '800.00');
});

test('two concurrent FIFO issues on the last unit never double-consume the layer', async () => {
  const productId = 'p-fifo-race';
  await prisma.product.create({ data: { id: productId, companyId: COMPANY, sku: 'RACE-1', name: 'Race', costPrice: 100, salePrice: 200, unit: 'PCS' } });
  await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('race-r1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 1, totalValue: '100', occurredAt: at(1),
  }));

  const attempts = await Promise.allSettled([1, 2].map((attempt) => serializableTx(prisma, (tx) => costing.recordIssue(tx, {
    ...source(`race-i${attempt}`), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 1, occurredAt: at(2),
  }))));
  const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0].reason?.message ?? rejected[0].reason), /tanpa biaya|bersamaan|sibuk/i);

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId, batchKey: '', method: 'FIFO',
  } } });
  assert.equal(state.quantity, 0);
  assert.equal(state.value.toFixed(2), '0.00');
  const layer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { companyId: COMPANY, productId } });
  assert.equal(layer.status, 'CONSUMED');
  assert.equal(layer.remainingQty, 0);
  const consumptions = await prisma.inventoryCostConsumption.findMany({ where: { layerId: layer.id } });
  assert.equal(consumptions.length, 1);
  assert.equal(consumptions.reduce((sum, row) => sum + row.quantity, 0), 1);
  assert.equal(consumptions.reduce((sum, row) => sum + Number(row.amount), 0), 100);
  assert.equal(await prisma.inventoryCostEvent.count({ where: { companyId: COMPANY, productId, eventType: 'ISSUE' } }), 1);
});

test('a backdated receipt with a later event is rejected without changing state or layers', async () => {
  const productId = 'p-backdated';
  await prisma.product.create({ data: { id: productId, companyId: COMPANY, sku: 'BACKDATED-1', name: 'Backdated', costPrice: 100, salePrice: 200, unit: 'PCS' } });
  await prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('backdated-r1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 2, totalValue: '200', occurredAt: at(5),
  }));

  await assert.rejects(() => prisma.$transaction((tx) => costing.recordReceipt(tx, {
    ...source('backdated-r2'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId,
    quantity: 1, totalValue: '100', occurredAt: at(3),
  })), /Backdated costing ditolak/);

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId, batchKey: '', method: 'FIFO',
  } } });
  assert.equal(state.quantity, 2);
  assert.equal(state.value.toFixed(2), '200.00');
  assert.equal(await prisma.inventoryCostLayer.count({ where: { companyId: COMPANY, productId } }), 1);
  assert.equal(await prisma.inventoryCostEvent.count({ where: { companyId: COMPANY, productId } }), 1);
});

test('ACTIVE FIFO rejects uncosted issue and SHADOW records it', async () => {
  await assert.rejects(() => prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('short-i1'), companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE, productId: 'p-short',
    quantity: 2, occurredAt: at(3),
  })), /tanpa biaya/);

  const SHADOW_BRANCH = 'br-shadow';
  const SHADOW_WAREHOUSE = 'wh-shadow';
  await prisma.branch.create({ data: { id: SHADOW_BRANCH, companyId: COMPANY, code: 'BRS', name: 'Cabang Shadow', isActive: true } });
  await prisma.warehouse.create({ data: { id: SHADOW_WAREHOUSE, code: 'WS', name: 'Gudang Shadow', branchId: SHADOW_BRANCH, isActive: true } });
  await prisma.product.create({ data: { id: 'p-shadow-lifo', companyId: COMPANY, sku: 'SL-1', name: 'Shadow LIFO', costPrice: 100, salePrice: 200, unit: 'PCS' } });
  await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: SHADOW_BRANCH, key: 'inventory.costing', enabled: true, scope: 'BRANCH' } });
  await prisma.costingPolicy.create({ data: {
    companyId: COMPANY, branchId: SHADOW_BRANCH, scopeKey: `branch:${SHADOW_BRANCH}`, method: 'LIFO', mode: 'SHADOW',
    status: 'ACTIVE', version: 1, effectiveFrom: at(1), approvedAt: at(1), approvedBy: APPROVER,
  } });
  const shadow = await prisma.$transaction((tx) => costing.recordIssue(tx, {
    ...source('shadow-i1'), companyId: COMPANY, branchId: SHADOW_BRANCH, warehouseId: SHADOW_WAREHOUSE, productId: 'p-shadow-lifo',
    quantity: 2, occurredAt: at(3),
  }));
  assert.equal(shadow.uncostedQuantity, 2);
  assert.equal(shadow.cost.toFixed(2), '0.00');
});

test('FIFO policy valuation and reports use the active method', async () => {
  const valuation = await policies.valuation(user, { warehouseId: WAREHOUSE });
  assert.equal(valuation.method, 'FIFO');
  const layers = await reports.layers(user, { warehouseId: WAREHOUSE, productId: 'p-fifo' });
  assert.equal(layers.method, 'FIFO');
  assert.equal(layers.items.length, 0);
  const recon = await reports.reconciliation(user, { warehouseId: WAREHOUSE });
  assert.equal(recon.method, 'FIFO');
});

test('FIFO backfill creates opening state, event, and layer', async () => {
  const BACK_BRANCH = 'br-fifo-backfill';
  const BACK_WAREHOUSE = 'wh-fifo-backfill';
  await prisma.branch.create({ data: { id: BACK_BRANCH, companyId: COMPANY, code: 'BRFB', name: 'Cabang Backfill FIFO', isActive: true } });
  await prisma.warehouse.create({ data: { id: BACK_WAREHOUSE, code: 'WFB', name: 'Gudang Backfill FIFO', branchId: BACK_BRANCH, isActive: true } });
  await prisma.product.create({ data: { id: 'p-backfill-fifo', companyId: COMPANY, sku: 'BF-FIFO', name: 'Backfill FIFO', costPrice: 250, salePrice: 300, unit: 'PCS' } });
  await prisma.inventory.create({ data: { warehouseId: BACK_WAREHOUSE, productId: 'p-backfill-fifo', quantity: 4, available: 4 } });
  await prisma.costingPolicy.create({ data: {
    companyId: COMPANY, branchId: BACK_BRANCH, scopeKey: `branch:${BACK_BRANCH}`, method: 'FIFO', mode: 'ACTIVE',
    status: 'ACTIVE', version: 1, effectiveFrom: at(1), approvedAt: at(1), approvedBy: APPROVER,
  } });
  const backUser = { ...user, branchId: BACK_BRANCH };
  const backApprover = { ...approver, branchId: BACK_BRANCH };
  const run = await rebuilds.request(backUser, { warehouseId: BACK_WAREHOUSE, cutoverAt: at(5).toISOString(), operationKey: 'fifo-backfill-0001' });
  assert.equal(run.method, 'FIFO');
  const completed = await rebuilds.approve(backApprover, run.id);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(Number(completed.statistics.layersCreated), 1);
  assert.equal(completed.statistics.method, 'FIFO');

  const state = await prisma.inventoryCostState.findUniqueOrThrow({ where: { companyId_branchId_warehouseId_productId_batchKey_method: {
    companyId: COMPANY, branchId: BACK_BRANCH, warehouseId: BACK_WAREHOUSE, productId: 'p-backfill-fifo', batchKey: '', method: 'FIFO',
  } } });
  assert.equal(state.quantity, 4);
  assert.equal(state.value.toFixed(2), '1000.00');
  const layer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { companyId: COMPANY, productId: 'p-backfill-fifo' } });
  assert.equal(layer.remainingQty, 4);
  assert.equal(layer.remainingValue.toFixed(2), '1000.00');
  const opening = await prisma.inventoryCostEvent.findFirstOrThrow({ where: { companyId: COMPANY, productId: 'p-backfill-fifo' } });
  assert.equal(opening.eventType, 'OPENING');
  assert.equal(opening.method, 'FIFO');
  assert.equal(layer.sourceEventId, opening.id);

  const recon = await reports.reconciliation(backUser, { warehouseId: BACK_WAREHOUSE });
  assert.equal(recon.method, 'FIFO');
  assert.equal(recon.totals.layerApplicable, true);
  assert.equal(recon.byWarehouse[0].valueDifference, '0.00');
  assert.equal(recon.totals.matched, true);
  const layerReport = await reports.layers(backUser, { warehouseId: BACK_WAREHOUSE });
  assert.equal(layerReport.items.length, 1);
  assert.equal(layerReport.items[0].remainingQty, 4);
});

