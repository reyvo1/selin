import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  HYGIENE_EXEMPTIONS,
  MIN_EXEMPTION_RATIONALE,
  classifyTrackedFile,
  findForbiddenTrackedFiles,
  isPlaceholderCredential,
  trackedHygieneFailures,
} from '../scripts/lib/tracked-hygiene.mjs';

const root = process.cwd();
const rules = (file, content = '') => classifyTrackedFile({ file, content }).map((v) => v.rule);

// Konten terlarang dibangun saat runtime. Menaruh literalnya di file test
// berarti file test itu sendiri melanggar aturan yang sedang diuji - memang
// begitu seharusnya: gerbang membaca setiap file tracked, termasuk test ini.
const badPassword = ['sup', 'er', 'sec', 'ret', 'pw'].join('');
const badConnectionString = `postgresql://dbuser:${badPassword}@db.internal:5432/toko360`;
const badAccessKey = ['AKIA', '1234567890ABCDEF'].join('');
const badPrivateKey = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');

test('real repository has no tracked credential or generated runtime evidence', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  assert.ok(tracked.length > 100, 'git ls-files must return the repository');
  const failures = trackedHygieneFailures({ root, tracked });
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('placeholder examples stay allowed so documentation is not punished', () => {
  assert.deepEqual(rules('.env.example'), []);
  assert.deepEqual(rules('config/stage18-postgres.env.example'), []);
  assert.equal(isPlaceholderCredential('CHANGE_ME_PASSWORD'), true);
  assert.equal(isPlaceholderCredential('toko360_ci_password'), true);
  assert.equal(isPlaceholderCredential('USER'), true);
  assert.equal(isPlaceholderCredential(badPassword), false);
});

test('an env file is forbidden at any path, not only the historical one', () => {
  // The retired rule matched a single literal path, so every other staging
  // env file passed green.
  assert.ok(rules('staging.env').includes('env-file'));
  assert.ok(rules('config/secrets/payroll.env').includes('env-file'));
  assert.ok(rules('.env.staging').includes('env-file'));
  assert.ok(rules('deploy/env/backend.env').includes('env-file'));
});

test('key, credential container, generated evidence, logs and recovery backups are forbidden generically', () => {
  assert.ok(rules('server.pem').includes('key-file'));
  assert.ok(rules('ops/id_rsa').includes('key-file'));
  assert.ok(rules('config/credentials.json').includes('credential-file'));
  assert.ok(rules('handoff/quality/anything.json').includes('generated-quality'));
  assert.ok(rules('logs/uat-anything/probe.json').includes('runtime-log'));
  assert.ok(rules('backup/state.recovery-backup').includes('recovery-backup'));
});

test('the three historical logs directories are no longer the whole rule', () => {
  for (const file of [
    'logs/payroll-adjustment-postgres-stage/x.json',
    'logs/report-exports/x.json',
    'logs/stage20-release-readiness/x.json',
  ]) assert.ok(rules(file).includes('runtime-log'), file);
  assert.ok(rules('logs/some-new-runtime-dir/x.json').includes('runtime-log'));
});

test('connection strings with non-placeholder credentials are forbidden anywhere', () => {
  const violations = classifyTrackedFile({ file: 'deploy/values.yml', content: badConnectionString });
  assert.ok(violations.some((v) => v.rule === 'secret-content'), JSON.stringify(violations));
  const placeholder = classifyTrackedFile({
    file: 'deploy/values.yml',
    content: 'postgresql://USER:PASSWORD@HOST:5432/db',
  });
  assert.deepEqual(placeholder, []);
});

test('provider tokens and private keys are forbidden without a placeholder escape', () => {
  assert.ok(rules('notes.txt', badAccessKey).includes('secret-content'));
  assert.ok(rules('notes.txt', badPrivateKey).includes('secret-content'));
  // Env-var interpolation is not a leaked secret.
  assert.deepEqual(rules('deploy.yml', 'DATABASE_URL=${DATABASE_URL}'), []);
});

test('exemptions are path-scoped and require a real rationale', () => {
  const file = 'staging.env';
  assert.throws(
    () => classifyTrackedFile({ file, content: '' }, { exemptions: [{ path: file, rule: 'env-file', rationale: 'short' }] }),
    new RegExp(`rationale of at least ${MIN_EXEMPTION_RATIONALE} characters`),
  );
  const allowed = classifyTrackedFile(
    { file, content: '' },
    { exemptions: [{ path: file, rule: 'env-file', rationale: 'Documented single-file fixture for the staging drill rehearsal.' }] },
  );
  assert.deepEqual(allowed, []);
  // A rule that is not the exempted one still fails.
  assert.ok(rules('server.pem').includes('key-file'));
  assert.deepEqual(HYGIENE_EXEMPTIONS, [], 'the shipped exemption set must stay empty and justified');
});

test('findForbiddenTrackedFiles reports file, rule and reason', () => {
  const failures = findForbiddenTrackedFiles({
    files: ['ops/extra.env', 'handoff/quality/report.json'],
    read: (file) => (file.endsWith('.env') ? 'DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/db' : '{}'),
  });
  assert.equal(failures.length, 2);
  assert.match(failures[0], /ops\/extra\.env \[env-file: /);
  assert.match(failures[1], /handoff\/quality\/report\.json \[generated-quality: /);
});

test('connection strings in test fixtures are skipped, provider tokens are not', () => {
  const fixtureUrl = `postgresql://alice:${badPassword}@db.internal:5432/db`;
  assert.deepEqual(classifyTrackedFile({ file: 'tests/fixture.test.mjs', content: fixtureUrl }), []);
  // Tier A still reads test files, so a leaked key cannot hide behind the
  // fixture rule.
  assert.ok(rules('tests/fixture.test.mjs', badAccessKey).includes('secret-content'));
  // And the same URL outside a fixture is caught.
  assert.ok(rules('deploy/values.yml', fixtureUrl).includes('secret-content'));
});

test('the retired allow-list would have passed files the general rule rejects', () => {
  const retired = (file) =>
    file === 'payroll-adjustment-postgres-stage.env' ||
    file.endsWith('.recovery-backup') ||
    /^handoff\/quality\/.+\.(json|md)$/.test(file) ||
    /^logs\/(payroll-adjustment-postgres-stage|report-exports|stage20-release-readiness)\//.test(file);
  const previouslyGreen = [
    'staging.env',
    'config/secrets/prod.env',
    'server.pem',
    'logs/uat-anything/probe.json',
    'ops/credentials.json',
  ];
  for (const file of previouslyGreen) {
    assert.equal(retired(file), false, `retired rule should not catch ${file}`);
    assert.ok(rules(file).length > 0, `general rule must catch ${file}`);
  }
});

test('audit entry point is wired to the general rule', () => {
  const audit = fs.readFileSync(path.join(root, 'scripts/audit-product-completeness.mjs'), 'utf8');
  assert.match(audit, /trackedHygieneFailures\(\{\s*root,\s*tracked\s*\}\)/);
  assert.doesNotMatch(audit, /file === 'payroll-adjustment-postgres-stage\.env'/);
});
