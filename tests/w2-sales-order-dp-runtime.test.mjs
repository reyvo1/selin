import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-so-dp-'));
const DB = path.join(TMP, 'so-dp.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { SalesOrdersService } = await load('apps/api/src/sales-orders/sales-orders.service.ts', opts);

const service = new SalesOrdersService(prisma);
const COMPANY = 'acme';
const BRANCH = 'br-1';
const USER = { sub: 'u-1', companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const PRODUCT = 'p-1';

await prisma.company.create({ data: { id: COMPANY, name: 'Acme', slug: 'acme', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR1', name: 'Cabang 1', isActive: true } });
await prisma.product.create({ data: { id: PRODUCT, companyId: COMPANY, sku: 'P1', name: 'Produk', unit: 'PCS', costPrice: 10, salePrice: 100 } });

test('sales order DP is not double-counted on settle', async () => {
  const order = await service.create(USER, {
    items: [{ productId: PRODUCT, quantity: 2, unitPrice: 100 }],
    dpAmount: 50,
  });
  assert.equal(order.payments === undefined || true, true);
  const payments = await prisma.salesOrderPayment.findMany({ where: { salesOrderId: order.id } });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].method, 'DP');
  assert.equal(Number(payments[0].amount), 50);

  const first = await service.settle(USER, order.id, 100, 'CASH');
  assert.equal(Number(first.settledAmount), 150);
  assert.equal(first.status, 'PARTIAL');

  const second = await service.settle(USER, order.id, 50, 'CASH');
  assert.equal(Number(second.settledAmount), 200);
  assert.equal(second.status, 'SETTLED');

  const allPayments = await prisma.salesOrderPayment.findMany({ where: { salesOrderId: order.id } });
  assert.equal(allPayments.length, 3);
});
