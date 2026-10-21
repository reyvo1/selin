// Retensi teknis harus berjalan otomatis, terbatas, dan tidak menyentuh data bisnis.
// Test ini mengunci: sumber ambang dari performance-budget, feature flag, batas batch,
// status final yang aman, payload mentah absensi dinull-kan (bukan event dihapus),
// index pendukung di tiga dialek schema, dan dokumentasi/perubahan env.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const worker = read('apps/worker/src/index.ts');
const retentionBody = worker.slice(
  worker.indexOf('async function runRetentionTick'),
  worker.indexOf('async function tick(): Promise<void>'),
);
const budget = JSON.parse(read('config/performance-budget.json'));

test('worker membaca ambang retensi dari performance-budget, bukan hardcode tersebar', () => {
  assert.match(worker, /config\/performance-budget\.json/);
  assert.match(retentionBody, /retentionDaysFromBudget\(\)/);
  for (const key of ['completedOutbox', 'successfulWebhookDelivery', 'technicalNotificationLog', 'successfulPayslipDeliveryLog', 'rawAttendanceDevicePayload']) {
    assert.match(retentionBody, new RegExp(`'${key}'`), `key retensi ${key} tidak dipakai`);
    assert.equal(typeof budget.retentionDays[key], 'number');
  }
});

test('retensi dapat dimatikan dan batch selalu terbatas', () => {
  assert.match(retentionBody, /RETENTION_AUTO_ENABLED === 'false'/);
  assert.match(retentionBody, /RETENTION_BATCH_SIZE/);
  assert.match(worker, /const RETENTION_MAX_BATCHES = 20;/);
  assert.match(retentionBody, /Math\.min\(Math\.max\(Number\(process\.env\.RETENTION_BATCH_SIZE \?\? 500\) \|\| 500, 1\), 5000\)/);
  assert.match(worker, /for \(let round = 0; round < RETENTION_MAX_BATCHES/);
});

test('hanya status final yang dipangkas', () => {
  assert.match(retentionBody, /status: 'DISPATCHED'/);
  assert.match(retentionBody, /status: 'DELIVERED'/);
  assert.match(retentionBody, /status: \{ in: \['SENT', 'DELIVERED'\] \}/);
  assert.match(retentionBody, /payrollResultId: \{ not: null \}/);
});

test('payload mentah absensi dinull-kan tanpa menghapus event bisnis', () => {
  const attendanceBlock = retentionBody.slice(retentionBody.indexOf('rawAttendancePayloads'));
  assert.match(attendanceBlock, /prisma\.attendanceEvent\.findMany/);
  assert.match(attendanceBlock, /prisma\.attendanceEvent\.updateMany/);
  assert.match(attendanceBlock, /sourcePayload: Prisma\.DbNull/);
  assert.doesNotMatch(attendanceBlock, /attendanceEvent\.deleteMany/);
});

test('retensi worker hanya menyentuh tabel teknis yang disetujui', () => {
  const delegates = new Set([...retentionBody.matchAll(/prisma\.(\w+)\.(?:findMany|deleteMany|updateMany)/g)].map((m) => m[1]));
  assert.deepEqual([...delegates].sort(), ['attendanceEvent', 'employeeNotificationDelivery', 'eventOutbox', 'notification', 'webhookDelivery']);
  assert.doesNotMatch(retentionBody, /prisma\.(?:sale|order|payment|inventoryMovement|journalEntry|payrollRun)\./);
});

test('tick worker menjalankan retensi setelah job lain', () => {
  const tickBody = worker.slice(worker.indexOf('async function tick(): Promise<void>'), worker.indexOf("type ReportFrequency"));
  assert.match(tickBody, /await processReportJobs\(\);\s*\n\s*await runRetentionTick\(\);/);
});

test('tiga dialek schema memiliki index pendukung retensi', () => {
  const expected = {
    EventOutbox: '@@index([status, publishedAt])',
    WebhookDelivery: '@@index([status, deliveredAt])',
    Notification: '@@index([status, createdAt])',
    EmployeeNotificationDelivery: '@@index([status, sentAt])',
    AttendanceEvent: '@@index([createdAt])',
  };
  for (const file of ['schema.prisma', 'schema.sqlite.prisma', 'schema.postgresql.prisma']) {
    const schema = read(`apps/api/prisma/${file}`);
    for (const [model, index] of Object.entries(expected)) {
      const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`));
      assert.ok(block, `${file}: model ${model} tidak ditemukan`);
      assert.ok(block[1].includes(index), `${file}: ${model} kehilangan ${index}`);
    }
  }
});

test('feature flag dan dokumentasi retensi tersedia', () => {
  assert.match(read('.env.example'), /RETENTION_AUTO_ENABLED=true/);
  assert.match(read('.env.example'), /RETENTION_BATCH_SIZE=500/);
  const docs = read('docs/LARGE-SCALE-DATA.md');
  assert.match(docs, /Retensi teknis dijalankan otomatis oleh worker/);
  assert.match(docs, /DataRetentionPolicy/);
});
