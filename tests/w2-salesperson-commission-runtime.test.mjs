import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-comm-'));
const DB = path.join(TMP, 'comm.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { CommissionsService } = await load('apps/api/src/commissions/commissions.service.ts', opts);

const service = new CommissionsService(prisma);
const COMPANY = 'acme';
const BRANCH = 'br-1';
const USER = { sub: 'u-1', companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const SALESPERSON = 'sp-1';
const WAREHOUSE = 'wh-1';

await prisma.company.create({ data: { id: COMPANY, name: 'Acme', slug: 'acme', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR1', name: 'Cabang 1', isActive: true } });
await prisma.warehouse.create({ data: { id: WAREHOUSE, branchId: BRANCH, code: 'W1', name: 'Gudang', isActive: true } });
await prisma.commissionRule.create({ data: { companyId: COMPANY, branchId: BRANCH, name: 'Komisi', basis: 'REVENUE', rate: 5, isActive: true } });

await prisma.sale.create({ data: { id: 's-1', number: 'POS-1', branchId: BRANCH, warehouseId: WAREHOUSE, customerId: null, salespersonId: SALESPERSON, status: 'COMPLETED', subtotal: 1000, discount: 0, tax: 0, serviceFee: 0, total: 1000, costTotal: 0, createdAt: new Date('2026-10-01T00:00:00Z') } });
await prisma.sale.create({ data: { id: 's-2', number: 'POS-2', branchId: BRANCH, warehouseId: WAREHOUSE, customerId: null, salespersonId: SALESPERSON, status: 'COMPLETED', subtotal: 500, discount: 0, tax: 0, serviceFee: 0, total: 500, costTotal: 0, createdAt: new Date('2026-10-02T00:00:00Z') } });
await prisma.sale.create({ data: { id: 's-3', number: 'POS-3', branchId: BRANCH, warehouseId: WAREHOUSE, customerId: null, salespersonId: null, status: 'COMPLETED', subtotal: 999, discount: 0, tax: 0, serviceFee: 0, total: 999, costTotal: 0, createdAt: new Date('2026-10-02T00:00:00Z') } });

test('commission payout aggregates assigned salesperson sales', async () => {
  const payouts = await service.computePayout(USER, { periodStart: '2026-10-01', periodEnd: '2026-10-31' });
  assert.equal(payouts.length, 1);
  assert.equal(payouts[0].salespersonId, SALESPERSON);
  assert.equal(Number(payouts[0].amount), 75); // 1500 * 5%
});

test('commission payout filters by salespersonId', async () => {
  const payouts = await service.computePayout(USER, { periodStart: '2026-10-01', periodEnd: '2026-10-31', salespersonId: SALESPERSON });
  assert.equal(payouts.length, 1);
});
