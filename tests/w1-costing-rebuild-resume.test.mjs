import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-costing-resume-'));
const DB = path.join(TMP, 'costing-resume.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { InventoryCostingRebuildService } = await load('apps/api/src/inventory/costing-rebuild.service.ts', opts);

const COMPANY = 'acme-resume';
const BRANCH = 'br-resume';
const WAREHOUSE = 'wh-resume';
const USER = 'u-resume';
const APPROVER = 'u-resume-approver';
const user = { sub: USER, companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const approver = { sub: APPROVER, companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };

await prisma.company.create({ data: { id: COMPANY, name: 'Acme', slug: 'acme-resume', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: USER, name: 'Resume User', email: 'resume@test', passwordHash: 'x', isActive: true },
  { id: APPROVER, name: 'Resume Approver', email: 'resume-approver@test', passwordHash: 'x', isActive: true },
] });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BRR', name: 'Cabang Resume', isActive: true } });
await prisma.warehouse.create({ data: { id: WAREHOUSE, code: 'WR', name: 'Gudang Resume', branchId: BRANCH, isActive: true } });
await prisma.product.createMany({ data: [
  { id: 'p-plain', companyId: COMPANY, sku: 'PL', name: 'Plain', costPrice: 250, salePrice: 300, unit: 'PCS' },
  { id: 'p-batch', companyId: COMPANY, sku: 'BT', name: 'Batch', costPrice: 100, salePrice: 150, unit: 'PCS', trackBatch: true },
] });
await prisma.inventory.createMany({ data: [
  { warehouseId: WAREHOUSE, productId: 'p-plain', quantity: 6, available: 6 },
  { warehouseId: WAREHOUSE, productId: 'p-batch', quantity: 5, available: 5 },
] });
await prisma.inventoryBatch.createMany({ data: [
  { warehouseId: WAREHOUSE, productId: 'p-batch', batchNumber: 'B-A', quantity: 2 },
  { warehouseId: WAREHOUSE, productId: 'p-batch', batchNumber: 'B-B', quantity: 3 },
] });
await prisma.costingPolicy.create({ data: {
  companyId: COMPANY, branchId: BRANCH, scopeKey: `branch:${BRANCH}`, method: 'FIFO', mode: 'ACTIVE',
  status: 'ACTIVE', version: 1, effectiveFrom: new Date('2026-01-01T00:00:00Z'), approvedAt: new Date('2026-01-01T00:00:00Z'), approvedBy: APPROVER,
} });

const rebuilds = new InventoryCostingRebuildService(prisma);

test('resume after simulated failure completes without duplicates', async () => {
  const cutoverAt = new Date().toISOString();
  const run = await rebuilds.request(user, { warehouseId: WAREHOUSE, cutoverAt, operationKey: 'resume-test-0001' });
  assert.equal(run.status, 'PENDING');

  const originalExecute = rebuilds.execute.bind(rebuilds);
  rebuilds.execute = async () => { throw new Error('simulated failure'); };
  await assert.rejects(() => rebuilds.approve(approver, run.id), /simulated failure/);
  rebuilds.execute = originalExecute;

  const failed = await prisma.costingRebuildRun.findUnique({ where: { id: run.id } });
  assert.equal(failed.status, 'FAILED');

  const completed = await rebuilds.resume(approver, run.id);
  assert.equal(completed.status, 'COMPLETED');

  const stateCount = await prisma.inventoryCostState.count({ where: { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE } });
  assert.equal(stateCount, 3);
  const eventCount = await prisma.inventoryCostEvent.count({ where: { companyId: COMPANY, sourceId: run.id } });
  assert.equal(eventCount, 3);
  const layerCount = await prisma.inventoryCostLayer.count({ where: { companyId: COMPANY, warehouseId: WAREHOUSE } });
  assert.equal(layerCount, 3);

  const finalRun = await prisma.costingRebuildRun.findUnique({ where: { id: run.id } });
  assert.ok(finalRun.checkpoint);

  // second call must not duplicate
  const second = await rebuilds.resume(approver, run.id);
  assert.equal(second.status, 'COMPLETED');
  const stateCount2 = await prisma.inventoryCostState.count({ where: { companyId: COMPANY, branchId: BRANCH, warehouseId: WAREHOUSE } });
  assert.equal(stateCount2, 3);
  const eventCount2 = await prisma.inventoryCostEvent.count({ where: { companyId: COMPANY, sourceId: run.id } });
  assert.equal(eventCount2, 3);
  const layerCount2 = await prisma.inventoryCostLayer.count({ where: { companyId: COMPANY, warehouseId: WAREHOUSE } });
  assert.equal(layerCount2, 3);
});