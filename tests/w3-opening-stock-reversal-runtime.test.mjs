import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-opening-stock-reversal-'));
const DB = path.join(TMP, 'stock-reversal.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { OpeningBalanceService } = await load('apps/api/src/opening-balance/opening-balance.service.ts', opts);
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', opts);
const service = new OpeningBalanceService(prisma, new AccountingCoreService(prisma));

const COMPANY = 'co-sr';
const BRANCH = 'br-sr';
const MAKER = { sub: 'u-maker-sr', email: 'maker-sr@test', name: 'Maker SR', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };
const CHECKER = { sub: 'u-checker-sr', email: 'checker-sr@test', name: 'Checker SR', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };

await prisma.company.create({ data: { id: COMPANY, name: 'SR Co', slug: 'sr-co', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: MAKER.sub, name: MAKER.name, email: MAKER.email, passwordHash: 'x', isActive: true },
  { id: CHECKER.sub, name: CHECKER.name, email: CHECKER.email, passwordHash: 'x', isActive: true },
] });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR-SR', name: 'SR Branch', isActive: true } });
await prisma.account.createMany({ data: [
  { id: 'acc-cash', branchId: BRANCH, code: '1101', name: 'Kas', type: 'ASSET', isActive: true },
  { id: 'acc-inv', branchId: BRANCH, code: '1301', name: 'Persediaan', type: 'ASSET', isActive: true },
  { id: 'acc-equity', branchId: BRANCH, code: '3101', name: 'Modal', type: 'EQUITY', isActive: true },
] });
await prisma.warehouse.create({ data: { id: 'wh-sr', branchId: BRANCH, code: 'WH-SR', name: 'Gudang SR', isActive: true } });
await prisma.product.create({ data: { id: 'prod-sr', companyId: COMPANY, sku: 'SKU-SR', name: 'Produk SR', unit: 'PCS', costPrice: 10, salePrice: 15, isActive: true } });
await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end', scope: 'BRANCH', enabled: true } });

test('stock opening reversal restores inventory', async () => {
  const batch = await service.create(MAKER, {
    type: 'STOCK', cutoverDate: '2026-01-01', controlAccountCode: '1301', offsetAccountCode: '3101', operationKey: 'sr-stock-0001',
    rows: [{ productId: 'prod-sr', warehouseId: 'wh-sr', quantity: 5, unitCost: 10, accountCode: '1301' }],
  });
  await service.submit(MAKER, batch.id);
  await service.approve(CHECKER, batch.id, 'ok');
  await service.post(CHECKER, batch.id);

  const before = await prisma.inventory.findUnique({ where: { warehouseId_productId: { warehouseId: 'wh-sr', productId: 'prod-sr' } } });
  assert.equal(before?.quantity, 5);

  await service.reverse(CHECKER, batch.id, { reason: 'reversal stock test' });

  const after = await prisma.inventory.findUnique({ where: { warehouseId_productId: { warehouseId: 'wh-sr', productId: 'prod-sr' } } });
  assert.equal(after?.quantity ?? 0, 0, 'inventory must be restored');
  const movements = await prisma.inventoryMovement.findMany({ where: { referenceType: 'OpeningBalanceBatch', referenceId: batch.id } });
  assert.ok(movements.some((m) => m.quantity < 0), 'reversal movement must exist');
});

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});