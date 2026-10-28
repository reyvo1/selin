import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');

const schemas = [
  ['canonical', 'apps/api/prisma/schema.prisma'],
  ['sqlite', 'apps/api/prisma/schema.sqlite.prisma'],
  ['postgresql', 'apps/api/prisma/schema.postgresql.prisma'],
];

const models = [
  'OpeningBalanceBatch',
  'OpeningBalanceRow',
  'OpeningLedgerDocument',
  'OpeningLedgerSettlement',
  'YearEndCloseRun',
  'YearEndCloseLine',
];

test('opening/year-end work item reached CLOSED', () => {
  const item = JSON.parse(read('work-items/completed/T360-20261021-134133-saldo-awal-dan-tutup-tahun.json'));
  assert.equal(item.phase, 'CLOSED');
  assert.equal(item.featureFlag, 'accounting.opening_and_year_end');
});

test('all schemas expose the six opening/year-end models and their enums', () => {
  for (const [name, path] of schemas) {
    const schema = read(path);
    for (const model of models) {
      assert.match(schema, new RegExp(`^model\\s+${model}\\s*\\{`, 'm'), `${name}: missing model ${model}`);
    }
    for (const enumName of [
      'OpeningBalanceType',
      'OpeningBalanceStatus',
      'OpeningLedgerKind',
      'OpeningLedgerStatus',
    ]) {
      assert.match(schema, new RegExp(`^enum\\s+${enumName}\\s*\\{`, 'm'), `${name}: missing enum ${enumName}`);
    }
    assert.match(schema, /@@unique\(\[companyId, operationKey\]\)/, `${name}: batch replay key missing`);
    assert.match(
      schema,
      /@@unique\(\[companyId, branchId, kind, documentNumber\]\)/,
      `${name}: ledger document identity missing`,
    );
    assert.match(
      schema,
      /@@unique\(\[companyId, branchId, fiscalYear, operationKey\]\)/,
      `${name}: year-end replay key missing`,
    );
  }
});

test('opening migration is registered and is expand-only', () => {
  const manifest = JSON.parse(read('config/expand-migration-order.json'));
  assert.ok(manifest.migrations.includes('T360-20261021-134133-opening-balance-year-end'));

  for (const file of ['sqlite-expand.sql', 'postgresql-expand.sql']) {
    const sql = read(`database/migrations/T360-20261021-134133-opening-balance-year-end/${file}`);
    for (const model of models) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${model}"`), `${file}: missing ${model}`);
    }
    assert.match(sql, /YearEndCloseRun_posted_scope_key/, `${file}: POSTED uniqueness index missing`);
    assert.match(sql, /WHERE "status" = 'POSTED'/, `${file}: POSTED uniqueness must be partial`);
    assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|DELETE FROM/i, `${file}: migration must stay expand-only`);
  }

  const readme = read('database/migrations/T360-20261021-134133-opening-balance-year-end/README.md');
  assert.match(readme, /Tidak ada backfill otomatis/i);
  assert.match(readme, /accounting\.opening_and_year_end/);
});

test('accounting core exposes system journal and reversal without a posting rule', () => {
  const source = read('apps/api/src/accounting-core/accounting-core.service.ts');
  assert.match(source, /async postSystemJournal\(/);
  assert.match(source, /async postReversal\(/);
  assert.match(source, /POST_SYSTEM_JOURNAL/);
  assert.match(source, /POST_SYSTEM_REVERSAL/);
  assert.match(source, /ruleId:\s*null/);
});

test('runtime foundation test is present', () => {
  const source = read('tests/w3-opening-year-end-foundation-runtime.test.mjs');
  assert.match(source, /system journal posts balanced multi-line entries/);
  assert.match(source, /reversal swaps journal sides/);
});
