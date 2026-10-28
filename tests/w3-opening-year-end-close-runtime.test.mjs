import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-year-end-runtime-'));
const DB = path.join(TMP, 'year-end.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { OpeningBalanceService } = await load('apps/api/src/opening-balance/opening-balance.service.ts', opts);
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', opts);
const service = new OpeningBalanceService(prisma, new AccountingCoreService(prisma));
const accounting = new AccountingCoreService(prisma);

const COMPANY = 'co-ye';
const BRANCH = 'br-ye';
const MAKER = { sub: 'u-maker-ye', email: 'maker-ye@test', name: 'Maker YE', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };
const CHECKER = { sub: 'u-checker-ye', email: 'checker-ye@test', name: 'Checker YE', companyId: COMPANY, branchId: BRANCH, roles: ['FINANCE'], permissions: [] };

await prisma.company.create({ data: { id: COMPANY, name: 'YE Co', slug: 'ye-co', timezone: 'Asia/Makassar', currency: 'IDR' } });
await prisma.user.createMany({ data: [
  { id: MAKER.sub, name: MAKER.name, email: MAKER.email, passwordHash: 'x', isActive: true },
  { id: CHECKER.sub, name: CHECKER.name, email: CHECKER.email, passwordHash: 'x', isActive: true },
] });
await prisma.branch.create({ data: { id: BRANCH, companyId: COMPANY, code: 'BR-YE', name: 'YE Branch', isActive: true } });
await prisma.account.createMany({ data: [
  { id: 'acc-cash', branchId: BRANCH, code: '1101', name: 'Kas', type: 'ASSET', isActive: true },
  { id: 'acc-equity', branchId: BRANCH, code: '3101', name: 'Modal', type: 'EQUITY', isActive: true },
  { id: 'acc-retained', branchId: BRANCH, code: '3201', name: 'Laba Ditahan', type: 'EQUITY', isActive: true },
  { id: 'acc-income', branchId: BRANCH, code: '3901', name: 'Income Summary', type: 'EQUITY', isActive: true },
  { id: 'acc-rev', branchId: BRANCH, code: '4101', name: 'Penjualan', type: 'REVENUE', isActive: true },
  { id: 'acc-exp', branchId: BRANCH, code: '5101', name: 'Beban', type: 'EXPENSE', isActive: true },
] });
await prisma.featureFlag.create({ data: { companyId: COMPANY, branchId: BRANCH, key: 'accounting.opening_and_year_end', scope: 'BRANCH', enabled: true } });

test('year-end close posts and creates snapshot batch', async () => {
  const batch = await service.create(MAKER, {
    type: 'GL', cutoverDate: '2026-01-01', operationKey: 'ye-gl-0001',
    rows: [
      { accountCode: '1101', debit: 100, credit: 0, description: 'cash' },
      { accountCode: '3101', debit: 0, credit: 100, description: 'equity' },
    ],
  });
  await service.submit(MAKER, batch.id);
  await service.approve(CHECKER, batch.id, 'ok');
  await service.post(CHECKER, batch.id);

  await prisma.$transaction((tx) => accounting.postSystemJournal(tx, {
    companyId: COMPANY,
    branchId: BRANCH,
    eventType: 'OPENING_BALANCE',
    sourceType: 'OPENING_BALANCE_BATCH',
    sourceId: 'revenue-expense-source',
    idempotencyKey: 'revenue-expense-key',
    businessDate: new Date('2026-06-01T00:00:00Z'),
    description: 'Revenue expense lines',
    actorId: CHECKER.sub,
    lines: [
      { accountCode: '4101', debit: 0, credit: 40 },
      { accountCode: '5101', debit: 40, credit: 0 },
    ],
  }));

  const gate = await service.getCutoverStatus(CHECKER);
  assert.equal(gate.ready, true, 'cutover gate must be ready');

  const run = await service.yearEndClose(CHECKER, {
    fiscalYear: 2026,
    retainedEarningsAccountCode: '3201',
    incomeSummaryAccountCode: '3901',
    operationKey: 'ye-close-0001',
  });
  assert.equal(run.status, 'POSTED', 'year-end close must be posted');

  const runs = await prisma.yearEndCloseRun.findMany({ where: { companyId: COMPANY, branchId: BRANCH } });
  assert.equal(runs.length, 1, 'one year-end close run');
  assert.equal(runs[0].journalEntryId !== null, true, 'journal entry created');

  const snapshot = await prisma.openingBalanceBatch.findFirst({ where: { companyId: COMPANY, branchId: BRANCH, operationKey: `year-end-snapshot-${run.id}` } });
  assert.ok(snapshot, 'snapshot batch created');

  const reversed = await service.reverseYearEndClose(CHECKER, { runId: run.id, reason: 'reversal test', operationKey: 'ye-reverse-0001' });
  assert.ok(reversed, 'reverse year-end close returns');
});

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(TMP, { recursive: true, force: true });
});