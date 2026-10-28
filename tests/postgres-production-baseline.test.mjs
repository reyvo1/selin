// Baseline migration PostgreSQL harus deterministik, versioned, dan expand-only.
// Test ini mengunci artefak rilis: baseline dibangun dari schema + post-migration SQL,
// memuat index pencarian trigram dan index retensi, serta mendeteksi drift schema.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const baselinePath = 'database/postgresql/releases/0001_baseline.sql';
const postMigrationPath = 'database/postgresql/post-migration/001-trigram-product-search.sql';

test('artefak baseline dan post-migration tersedia', () => {
  assert.equal(fs.existsSync(path.join(ROOT, baselinePath)), true);
  assert.equal(fs.existsSync(path.join(ROOT, postMigrationPath)), true);
  const baseline = read(baselinePath);
  assert.match(baseline, /GENERATED FILE - jangan edit manual/);
  assert.match(baseline, /Source schema: apps\/api\/prisma\/schema\.postgresql\.prisma/);
  assert.match(baseline, /Post-migration files: 2/);
  assert.match(baseline, /YearEndCloseRun_posted_scope_key/);
});

test('baseline memuat seluruh tabel inti dan tidak destruktif', () => {
  const baseline = read(baselinePath);
  for (const table of ['Product', 'ProductVariant', 'EventOutbox', 'WebhookDelivery', 'Notification', 'EmployeeNotificationDelivery', 'AttendanceEvent', 'Sale', 'InventoryMovement']) {
    assert.ok(baseline.includes(`CREATE TABLE "${table}"`), `tabel ${table} hilang dari baseline`);
  }
  const tableCount = (baseline.match(/CREATE TABLE /g) ?? []).length;
  assert.ok(tableCount >= 202, `jumlah tabel baseline menurun: ${tableCount}`);
  assert.doesNotMatch(baseline, /\bDROP TABLE\b|\bTRUNCATE\b/, 'baseline production tidak boleh destruktif');
});

test('pencarian nama produk memakai trigram PostgreSQL', () => {
  const baseline = read(baselinePath);
  assert.match(baseline, /CREATE EXTENSION IF NOT EXISTS pg_trgm;/);
  assert.match(baseline, /CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"\s+ON "Product" USING gin \("name" gin_trgm_ops\);/);
  assert.match(baseline, /"ProductVariant_name_trgm_idx"/);
  const postMigration = read(postMigrationPath);
  assert.match(postMigration, /CONCURRENTLY/);
});

test('index retensi otomatis ikut masuk baseline', () => {
  const baseline = read(baselinePath);
  for (const index of [
    'EventOutbox_status_publishedAt_idx',
    'WebhookDelivery_status_deliveredAt_idx',
    'Notification_status_createdAt_idx',
    'EmployeeNotificationDelivery_status_sentAt_idx',
    'AttendanceEvent_createdAt_idx',
  ]) {
    assert.ok(baseline.includes(index), `index retensi ${index} hilang dari baseline`);
  }
});

test('baseline tidak drift dari schema dan post-migration SQL', () => {
  execFileSync(process.execPath, ['scripts/build-postgres-baseline.mjs', '--check'], { cwd: ROOT, stdio: 'pipe' });
});

test('npm script regenerasi baseline tersedia', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['db:baseline:postgres'], 'node scripts/build-postgres-baseline.mjs');
  assert.equal(pkg.scripts['db:baseline:postgres:check'], 'node scripts/build-postgres-baseline.mjs --check');
});
