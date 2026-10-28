import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-opening-concurrency-'));
const DB = path.join(TMP, 'opening-concurrency.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const { OpeningBalanceService } = await load('apps/api/src/opening-balance/opening-balance.service.ts', { platform: 'node', external: ['@prisma/client'] });
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', { platform: 'node', external: ['@prisma/client'] });
const service = new OpeningBalanceService(prisma, new AccountingCoreService(prisma));

const COMPANY = 'co-conc';
const BRANCH = 'br-conc';
const MAKER = { sub: 'u-maker', email: 'maker@test', name: 'Maker', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };
const CHECKER = { sub: 'u-checker', email: 'checker@test', name: 'Checker', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };

await prisma.company.create({ data: { id: COMPANY, name: 'Concurrency Co', slug: 'conc-co', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: MAKER.sub, name: 'Maker', email: MAKER.email, passwordHash: 'x', isActive: true },
  { id: CHECKER.sub, name: 'Checker', email: CHECKER.email, passwordHash: 'x', isActive: true },
] });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR-CC', name: 'Concurrency Branch', isActive: true } });
await prisma.account.createMany({ data: [
  { id: 'acc-cash', branchId: BRANCH, code: '1101', name: 'Kas', type: 'ASSET', isActive: true },
  { id: 'acc-equity', branchId: BRANCH, code: '3101', name: 'Modal', type: 'EQUITY', isActive: true },
] });
await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end', scope: 'BRANCH', enabled: true } });

test('concurrent GL posting is idempotent', async () => {
  const batch = await service.create(MAKER, {
    type: 'GL', cutoverDate: '2026-01-01', operationKey: 'conc-gl-0001',
    rows: [
      { accountCode: '1101', debit: 100, credit: 0, description: 'cash' },
      { accountCode: '3101', debit: 0, credit: 100, description: 'equity' },
    ],
  });
  await service.submit(MAKER, batch.id);
  await service.approve(CHECKER, batch.id, 'ok');

  const results = await Promise.allSettled([service.post(CHECKER, batch.id), service.post(CHECKER, batch.id)]);
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  assert.ok(fulfilled.length >= 1, 'At least one posting must succeed');
  const posted = await service.get(CHECKER, batch.id);
  assert.equal(posted.status, 'POSTED');

  const eventCount = await prisma.accountingEvent.count({ where: { sourceType: 'OPENING_BALANCE_BATCH', sourceId: batch.id } });
  assert.equal(eventCount, 1, 'Concurrent posting must not duplicate accounting event');
});

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});
