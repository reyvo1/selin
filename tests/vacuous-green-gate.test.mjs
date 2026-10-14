import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CI_GENERATED_ARTIFACT,
  GITHUB_LOG_ARCHIVE,
  REPOSITORY_FILE,
  SOURCE_COMMIT,
  UNRESOLVED,
  classifyEvidence,
  collectScriptSource,
  validateEvidenceArray,
  validateRegistry,
} from '../scripts/lib/evidence-resolver.mjs';
import {
  SOURCE_BINDING_EXEMPTIONS,
  assertSourceBinding,
  declaredProductionTouched,
  evaluateScenarioCoverage,
} from '../scripts/lib/r8-evidence-binding.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const scriptSource = collectScriptSource(ROOT);
const declaredArtifacts = new Set([
  'handoff/quality/github-r3-residual-probe-latest.json',
  'handoff/quality/fabricated-artifact.json',
]);
const context = { root: ROOT, declaredArtifacts, scriptSource };

const bound = (value = 'f1ng3rpr1nt') => ({ status: 'PASS', sourceIdentity: { value } });

test('prosa bebas tidak pernah dihitung sebagai evidence', () => {
  assert.equal(classifyEvidence('historical automated evidence only', context).kind, UNRESOLVED);
  assert.equal(classifyEvidence('Exact-source GitHub commit abc: Browser UAT PASS, aggregate PASS.', context).kind, UNRESOLVED);
  assert.equal(classifyEvidence('', context).kind, 'EMPTY');
});

test('evidence kind dikenali: path repository, log run, source commit, CI artifact', () => {
  assert.equal(classifyEvidence('docs/PROJECT-STATE.md', context).kind, REPOSITORY_FILE);
  assert.equal(classifyEvidence('logs_97860254545.zip', context).kind, GITHUB_LOG_ARCHIVE);
  assert.equal(classifyEvidence('source-commit:abac92662cab4cc7352de4f9f9d2e2419aad9c29', context).kind, SOURCE_COMMIT);
  assert.equal(classifyEvidence('handoff/quality/github-r3-residual-probe-latest.json', context).kind, CI_GENERATED_ARTIFACT);
});

test('CI artifact yang dideklarasikan tapi tidak diproduksi script mana pun ditolak', () => {
  const classified = classifyEvidence('handoff/quality/fabricated-artifact.json', context);
  assert.equal(classified.kind, UNRESOLVED);
  assert.match(classified.reason, /tidak diproduksi oleh script/);
});

test('RUNTIME_VERIFIED dengan evidence prosa gagal, bukan lolos karena array tidak kosong', () => {
  const failures = validateEvidenceArray(
    { id: 'feature:pos_offline', status: 'RUNTIME_VERIFIED', evidence: ['historical automated evidence only'] },
    context,
  );
  assert.ok(failures.length >= 1, 'prosa harus menghasilkan minimal satu kegagalan');
  assert.ok(failures.some((failure) => /tidak dapat diverifikasi/.test(failure)), failures.join('\n'));
});

test('RUNTIME_VERIFIED memerlukan concrete anchor, bukan hanya log run', () => {
  const logsOnly = validateEvidenceArray(
    { id: 'audit:X', status: 'RUNTIME_VERIFIED', evidence: ['logs_1.zip', 'logs_2.zip'] },
    context,
  );
  assert.ok(logsOnly.some((failure) => /concrete anchor/.test(failure)), logsOnly.join('\n'));

  const paired = validateEvidenceArray(
    { id: 'audit:X', status: 'RUNTIME_VERIFIED', evidence: ['source-commit:abac92662cab4cc7352de4f9f9d2e2419aad9c29', 'logs_1.zip'] },
    context,
  );
  assert.deepEqual(paired, [], paired.join('\n'));
});

test('registry CI artifact yang tidak diproduksi script mana pun ditolak', () => {
  const failures = validateRegistry({
    root: ROOT,
    matrix: { runtimeEvidenceArtifacts: ['handoff/quality/fabricated-artifact.json'] },
    scriptSource,
  });
  assert.equal(failures.length, 1, failures.join('\n'));
  assert.match(failures[0], /not produced by any script under scripts\//);
});

test('artifact tanpa sourceIdentity gagal terikat, kecuali exempt dengan alasan rinci', () => {
  assert.throws(() => assertSourceBinding({ r1: { status: 'PASS' } }, 'f1ng3rpr1nt'), /tanpa sourceIdentity/);
  assert.throws(() => assertSourceBinding({ r1: bound('lain') }, 'f1ng3rpr1nt'), /stale source/);
  assert.doesNotThrow(() => assertSourceBinding({ r1: bound() }, 'f1ng3rpr1nt'));
  assert.doesNotThrow(() => assertSourceBinding({ r1: { status: 'PASS' } }, 'f1ng3rpr1nt', { r1: 'alasan exemption yang cukup rinci' }));
  assert.throws(() => assertSourceBinding({ r1: { status: 'PASS' } }, 'f1ng3rpr1nt', { r1: 'pendek' }), /tanpa sourceIdentity/);
  assert.deepEqual(SOURCE_BINDING_EXEMPTIONS, {}, 'daftar exemption harus tetap kosong agar tidak ada jalan pintas terselubung');
});

test('coverage skenario diturunkan dari artifact terikat, bukan panjang tabel', () => {
  const scenarios = [{ id: 'UAT-01', executedEvidence: ['r1', 'r3'] }];
  const covered = evaluateScenarioCoverage(scenarios, { r1: bound(), r3: bound() }, 'f1ng3rpr1nt');
  assert.equal(covered.length, 1);
  assert.equal(covered[0].covered, true);

  const missing = evaluateScenarioCoverage(scenarios, { r1: bound() }, 'f1ng3rpr1nt');
  assert.equal(missing[0].covered, false);
  assert.deepEqual(missing[0].missing, ['r3']);

  const stale = evaluateScenarioCoverage(scenarios, { r1: bound(), r3: bound('berbeda') }, 'f1ng3rpr1nt');
  assert.equal(stale[0].covered, false);
  assert.deepEqual(stale[0].unbound, ['r3']);

  const emptyRefs = evaluateScenarioCoverage([{ id: 'UAT-02', executedEvidence: [] }], { r1: bound() }, 'f1ng3rpr1nt');
  assert.equal(emptyRefs[0].covered, false, 'baris tanpa artifact pendukung tidak boleh dihitung tercakup');
});

test('productionTouched=true terdeteksi, productionTouched=false tidak', () => {
  assert.deepEqual(declaredProductionTouched({ r1: { productionTouched: false }, r2: {} }), []);
  assert.deepEqual(declaredProductionTouched({ r1: { productionTouched: true } }), ['r1']);
});

test('kanonik tetap lolos audit dengan aturan ketat dan productReady tetap false', () => {
  const output = execFileSync(process.execPath, ['scripts/audit-product-completeness.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /Product completeness audit PASS/);
  const matrix = JSON.parse(readFileSync(`${ROOT}config/product-completeness.json`, 'utf8'));
  assert.equal(matrix.productReady, false);
  assert.equal(matrix.humanStage20, 'PENDING');
  assert.ok(Array.isArray(matrix.runtimeEvidenceArtifacts) && matrix.runtimeEvidenceArtifacts.length > 0);
});

test('probe R8 tidak lagi memancarkan check tetap dan tidak lagi melewatkan binding', () => {
  const probe = readFileSync(`${ROOT}scripts/ci-r8-release-evidence-probe.mjs`, 'utf8');
  assert.ok(!/executedCriticalScenarios:\s*scenarios\.length\s*===\s*12/.test(probe), 'executedCriticalScenarios tidak boleh lagi berasal dari panjang tabel');
  assert.ok(!/exactSource:\s*true/.test(probe), 'exactSource tidak boleh lagi konstanta true');
  assert.ok(!/r8ReportingSecurity:\s*true/.test(probe), 'r8ReportingSecurity tidak boleh lagi konstanta true');
  assert.ok(!/humanStage20Pending:\s*true/.test(probe), 'humanStage20Pending tidak boleh lagi konstanta true');
  assert.ok(!/if\s*\(\s*s\s*&&\s*s\s*!==\s*source\.value\s*\)/.test(probe), 'pemeriksaan stale source tidak boleh lagi dilewati saat s kosong');
  assert.match(probe, /assertSourceBinding\(evidence, source\.value, SOURCE_BINDING_EXEMPTIONS\)/);
  assert.match(probe, /evaluateScenarioCoverage\(/);
});
