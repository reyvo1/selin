import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-opening-foundation-'));
const DB = path.join(TMP, 'opening-foundation.db');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', 'apps/api/prisma/schema.sqlite.prisma'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', opts);
const accounting = new AccountingCoreService(prisma);

const COMPANY = 'acme-opening';
const BRANCH = 'br-opening';
const OTHER_COMPANY = 'other-opening';
const OTHER_BRANCH = 'br-other-opening';
const USER = 'u-opening';
const at = (value) => new Date(`${value}T00:00:00Z`);
const tx = (fn) => prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

await prisma.company.createMany({ data: [
  { id: COMPANY, name: 'Acme Opening', slug: 'acme-opening', timezone: 'Asia/Makassar', currency: 'IDR' },
  { id: OTHER_COMPANY, name: 'Other Opening', slug: 'other-opening', timezone: 'Asia/Makassar', currency: 'IDR' },
] });
await prisma.user.create({ data: { id: USER, name: 'Opening User', email: 'opening@test', passwordHash: 'x', isActive: true } });
await prisma.branch.createMany({ data: [
  { id: BRANCH, companyId: COMPANY, code: 'BRO', name: 'Cabang Opening', isActive: true },
  { id: OTHER_BRANCH, companyId: OTHER_COMPANY, code: 'BROT', name: 'Cabang Other', isActive: true },
] });
await prisma.account.createMany({ data: [
  { id: 'acc-cash', branchId: BRANCH, code: '1101', name: 'Kas', type: 'ASSET', isActive: true },
  { id: 'acc-inventory', branchId: BRANCH, code: '1301', name: 'Persediaan', type: 'ASSET', isActive: true },
  { id: 'acc-payable', branchId: BRANCH, code: '2101', name: 'Utang Usaha', type: 'LIABILITY', isActive: true },
  { id: 'acc-equity', branchId: BRANCH, code: '3101', name: 'Modal Saldo Awal', type: 'EQUITY', isActive: true },
  { id: 'acc-revenue', branchId: BRANCH, code: '4101', name: 'Penjualan', type: 'REVENUE', isActive: true },
  { id: 'acc-inactive', branchId: BRANCH, code: '1800', name: 'Akun Nonaktif', type: 'ASSET', isActive: false },
] });
await prisma.fiscalPeriod.createMany({ data: [
  { id: 'fp-2026', companyId: COMPANY, branchId: BRANCH, name: '2026', startDate: at('2026-01-01'), endDate: at('2026-12-31'), status: 'OPEN' },
  { id: 'fp-2027', companyId: COMPANY, branchId: BRANCH, name: '2027', startDate: at('2027-01-01'), endDate: at('2027-12-31'), status: 'CLOSED' },
  { id: 'fp-2028', companyId: COMPANY, branchId: BRANCH, name: '2028', startDate: at('2028-01-01'), endDate: at('2028-12-31'), status: 'SOFT_CLOSED' },
] });

let sequence = 0;
const postSystem = (lines, overrides = {}) => {
  sequence += 1;
  return tx((client) => accounting.postSystemJournal(client, {
    companyId: COMPANY,
    branchId: BRANCH,
    eventType: 'OPENING_BALANCE',
    sourceType: 'OPENING_BALANCE_BATCH',
    sourceId: `opening-source-${sequence}`,
    idempotencyKey: `opening-key-${sequence}`,
    businessDate: at('2026-01-05'),
    description: `Opening ${sequence}`,
    actorId: USER,
    lines,
    ...overrides,
  }));
};
const postReversal = (originalEventId, overrides = {}) => {
  sequence += 1;
  return tx((client) => accounting.postReversal(client, {
    companyId: COMPANY,
    branchId: BRANCH,
    originalEventId,
    idempotencyKey: `reversal-key-${sequence}`,
    businessDate: at('2026-02-01'),
    reason: 'Koreksi saldo awal',
    actorId: USER,
    ...overrides,
  }));
};
const counts = async () => ({
  events: await prisma.accountingEvent.count(),
  journals: await prisma.journalEntry.count(),
  postings: await prisma.accountingPosting.count(),
  audits: await prisma.auditLog.count({ where: { action: { in: ['POST_SYSTEM_JOURNAL', 'POST_SYSTEM_REVERSAL'] } } }),
});

test('system journal posts balanced multi-line entries without a posting rule and replays idempotently', async () => {
  const lines = [
    { accountCode: '1101', debit: '1250.50', description: 'Kas' },
    { accountCode: '1301', debit: '500.00', description: 'Persediaan' },
    { accountCode: '3101', credit: '1750.50', description: 'Modal' },
  ];
  const event = await postSystem(lines, { sourceId: 'opening-gl-1', idempotencyKey: 'opening-gl-1' });
  assert.equal(event.status, 'POSTED');
  assert.equal(event.eventType, 'OPENING_BALANCE');
  assert.equal(event.postings.length, 1);
  assert.equal(event.postings[0].ruleId, null);
  assert.equal(event.lines.length, 3);
  assert.equal(event.journalEntryId !== null, true);

  const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: event.journalEntryId }, include: { lines: true } });
  assert.equal(journal.lines.length, 3);
  assert.equal(journal.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0)).toFixed(2), '1750.50');
  assert.equal(journal.lines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0)).toFixed(2), '1750.50');
  assert.equal(await prisma.taxTransaction.count({ where: { accountingEventId: event.id } }), 0);

  const before = await counts();
  const replay = await postSystem([...lines].reverse(), { sourceId: 'opening-gl-1', idempotencyKey: 'opening-gl-1' });
  assert.equal(replay.id, event.id);
  assert.deepEqual(await counts(), before);

  await assert.rejects(
    () => postSystem([
      { accountCode: '1101', debit: '1250.51' },
      { accountCode: '3101', credit: '1250.51' },
    ], { sourceId: 'opening-gl-1', idempotencyKey: 'opening-gl-1' }),
    /payload yang berbeda/,
  );
  assert.deepEqual(await counts(), before);
});

test('system journal rejects unbalanced, invalid, and out-of-scope lines before creating evidence', async () => {
  const before = await counts();
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '100.00' },
    { accountCode: '3101', credit: '99.99' },
  ]), /tidak seimbang/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '-1' },
    { accountCode: '3101', credit: '-1' },
  ]), /tidak boleh negatif/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '1', credit: '1' },
  ]), /hanya boleh berisi debit atau kredit/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '0' },
    { accountCode: '3101', credit: '0' },
  ]), /tidak boleh bernilai nol/);
  await assert.rejects(() => postSystem([
    { accountCode: '1800', debit: '10' },
    { accountCode: '3101', credit: '10' },
  ]), /Akun tidak aktif/);
  await assert.rejects(() => postSystem([
    { accountCode: '9999', debit: '10' },
    { accountCode: '3101', credit: '10' },
  ]), /Akun belum dikonfigurasi/);
  await assert.rejects(() => postSystem([], { eventType: 'MANUAL' }), /tidak diizinkan/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '10' },
    { accountCode: '3101', credit: '10' },
  ], { sourceType: 'YEAR_END_CLOSE_RUN' }), /Source type/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '10' },
    { accountCode: '3101', credit: '10' },
  ], { companyId: COMPANY, branchId: OTHER_BRANCH }), /Branch system journal tidak ditemukan/);
  assert.deepEqual(await counts(), before);
});

test('system journal honors accounting close control and fiscal period locks atomically', async () => {
  const before = await counts();
  const control = await prisma.accountingCloseControl.create({ data: {
    companyId: COMPANY, branchId: BRANCH, module: 'ACCOUNTING',
    periodStart: at('2026-03-01'), periodEnd: at('2026-03-31'), status: 'CLOSED', closedById: USER, closedAt: at('2026-03-31'),
  } });
  try {
    await assert.rejects(() => postSystem([
      { accountCode: '1101', debit: '25' },
      { accountCode: '3101', credit: '25' },
    ], { businessDate: at('2026-03-15') }), /Accounting close control ACCOUNTING/);
  } finally {
    await prisma.accountingCloseControl.delete({ where: { id: control.id } });
  }
  assert.deepEqual(await counts(), before);

  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '25' },
    { accountCode: '3101', credit: '25' },
  ], { businessDate: at('2027-06-01') }), /Periode fiskal berstatus CLOSED/);
  await assert.rejects(() => postSystem([
    { accountCode: '1101', debit: '25' },
    { accountCode: '3101', credit: '25' },
  ], { businessDate: at('2028-06-01') }), /Periode fiskal berstatus SOFT_CLOSED/);
  assert.deepEqual(await counts(), before);

  const retry = await postSystem([
    { accountCode: '1101', debit: '25' },
    { accountCode: '3101', credit: '25' },
  ], { businessDate: at('2026-03-15') });
  assert.equal(retry.status, 'POSTED');
});

test('reversal swaps journal sides, marks the original, and rejects divergent retries', async () => {
  const original = await postSystem([
    { accountCode: '1101', debit: '400.00', description: 'Kas opening' },
    { accountCode: '3101', credit: '400.00', description: 'Modal opening' },
  ], { sourceId: 'opening-reversal-1', idempotencyKey: 'opening-reversal-1', businessDate: at('2026-04-01') });
  const reversal = await postReversal(original.id, { idempotencyKey: 'reversal-original-1', businessDate: at('2026-04-02'), reason: 'Saldo awal salah' });
  assert.equal(reversal.reversalOfId, original.id);
  assert.equal(reversal.eventType, original.eventType);
  assert.equal(reversal.status, 'POSTED');
  assert.equal(reversal.postings.length, 1);
  assert.equal(reversal.postings[0].ruleId, null);

  const originalAfter = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: original.id }, include: { postings: true } });
  assert.equal(originalAfter.status, 'REVERSED');
  assert.equal(originalAfter.postings[0].status, 'REVERSED');
  assert.notEqual(originalAfter.postings[0].reversedAt, null);
  assert.equal(originalAfter.journalEntryId, original.journalEntryId);

  const reversalJournal = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: reversal.journalEntryId },
    include: { lines: { include: { account: true } } },
  });
  const cash = reversalJournal.lines.find((line) => line.account.code === '1101');
  const equity = reversalJournal.lines.find((line) => line.account.code === '3101');
  assert.equal(cash.credit.toFixed(2), '400.00');
  assert.equal(cash.debit.toFixed(2), '0.00');
  assert.equal(equity.debit.toFixed(2), '400.00');
  assert.equal(equity.credit.toFixed(2), '0.00');

  const before = await counts();
  const replay = await postReversal(original.id, {
    idempotencyKey: 'reversal-original-1',
    businessDate: at('2026-04-02'),
    reason: 'Saldo awal salah',
  });
  assert.equal(replay.id, reversal.id);
  assert.deepEqual(await counts(), before);

  await assert.rejects(() => postReversal(original.id, {
    idempotencyKey: 'reversal-original-1',
    businessDate: at('2026-04-02'),
    reason: 'Alasan berbeda',
  }), /payload yang berbeda/);
  await assert.rejects(() => postReversal(original.id, { reason: 'Pembalikan kedua' }), /berstatus REVERSED/);
  await assert.rejects(() => postReversal(reversal.id, { reason: 'Membalik reversal' }), /tidak dapat dibalik lagi/);
  assert.deepEqual(await counts(), before);
});

test('reversal outside the open period is rejected without changing the original event', async () => {
  const original = await postSystem([
    { accountCode: '1101', debit: '75.00' },
    { accountCode: '3101', credit: '75.00' },
  ], { sourceId: 'opening-period-1', idempotencyKey: 'opening-period-1', businessDate: at('2026-05-01') });
  await assert.rejects(() => postReversal(original.id, {
    businessDate: at('2027-06-01'),
    reason: 'Terlambat',
  }), /Periode fiskal berstatus CLOSED/);

  const unchanged = await prisma.accountingEvent.findUniqueOrThrow({ where: { id: original.id }, include: { postings: true } });
  assert.equal(unchanged.status, 'POSTED');
  assert.equal(unchanged.postings[0].reversedAt, null);
  assert.equal(await prisma.accountingEvent.count({ where: { reversalOfId: original.id } }), 0);
});
