import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectScriptSource, loadDeclaredArtifacts, validateEvidenceArray } from '../scripts/lib/evidence-resolver.mjs';
import { classifyTrackedFile } from '../scripts/lib/tracked-hygiene.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const matrix = JSON.parse(read('config/product-completeness.json'));
const scriptSource = collectScriptSource(root);
const declaredArtifacts = loadDeclaredArtifacts(matrix);

test('P0 establishes one canonical product completeness authority', () => {
  assert.equal(matrix.authoritative, true);
  assert.equal(matrix.policy.canonicalStatusSource, 'config/product-completeness.json');
  assert.equal(matrix.productReady, false);
  assert.equal(matrix.humanStage20, 'PENDING');
  assert.ok(matrix.features.length >= 30);
  assert.equal(matrix.legacyFunctionalPhases.length, 12);
  // 15 post-audit findings (A-01..A-15) plus A-16, raised when the A-14
  // curated-phrasing guard was found to miss a matrix distribution claim.
  assert.equal(matrix.postAuditFindings.length, 16);
});

test('P0 forbids marker-only closure and requires human UI acceptance', () => {
  assert.equal(matrix.policy.sourceMarkersCannotClose, true);
  assert.equal(matrix.policy.runtimeEvidenceRequiredForCriticalHigh, true);
  assert.equal(matrix.policy.humanAcceptanceRequiredForUiClosure, true);
  for (const finding of matrix.postAuditFindings.filter((x) => ['CRITICAL','HIGH'].includes(x.severity))) {
    if (['RUNTIME_VERIFIED','HUMAN_ACCEPTED'].includes(finding.status)) {
      // Length is not evidence: every entry must classify as something real.
      // A prose sentence inside the array used to satisfy this assertion.
      assert.ok(finding.evidence?.length, `${finding.id} must carry evidence`);
      assert.deepEqual(
        validateEvidenceArray(finding, { root, declaredArtifacts, scriptSource }),
        [],
        `${finding.id} evidence must resolve`,
      );
    }
  }
});

test('P0 removes credentials and excludes generated evidence from active tracked source', () => {
  const auditSource = read('scripts/audit-product-completeness.mjs');
  assert.match(auditSource, /git',[\s\S]*'ls-files'/);
  // The literal-path assertion that used to live here asserted the retired
  // five-path allow-list, which only ever matched one env file. It was the
  // defect, so it was converted to a behaviour-level control below and in
  // tests/tracked-hygiene-gate.test.mjs rather than kept green.
  assert.match(auditSource, /trackedHygieneFailures\(\{\s*root,\s*tracked\s*\}\)/);
  assert.doesNotMatch(auditSource, /file === 'payroll-adjustment-postgres-stage\.env'/);
  const ignore = read('.gitignore');
  assert.match(ignore, /payroll-adjustment-postgres-stage\.env/);
  assert.match(ignore, /\*\.recovery-backup/);
  assert.match(ignore, /handoff\/quality\/\*\.json/);
  assert.match(ignore, /logs\/payroll-adjustment-postgres-stage\//);
  assert.match(ignore, /logs\/stage20-release-readiness\//);
  assert.match(read('scripts/lib/tracked-hygiene.mjs'), /Generated\/credential artifact must not be tracked/);
  // Behaviour, not source shape: the rule must actually reject a credential
  // file at a path the retired allow-list never inspected.
  assert.ok(classifyTrackedFile({ file: 'staging.env', content: '' }).some((v) => v.rule === 'env-file'));
  assert.ok(classifyTrackedFile({ file: 'logs/uat-anything/probe.json', content: '' }).some((v) => v.rule === 'runtime-log'));
});

test('legacy status documents defer to canonical matrix', () => {
  for (const p of ['docs/PROJECT-STATE.md','STATUS-FINAL.md','docs/FUNCTIONAL-DEPTH-ROADMAP.md','docs/FEATURE-CATALOG.md']) {
    assert.match(read(p), /config\/product-completeness\.json/, p);
  }
  assert.equal(JSON.parse(read('config/functional-depth-roadmap.json')).statusAuthority, 'config/product-completeness.json');
  assert.equal(JSON.parse(read('config/recovery-finding-matrix.json')).statusAuthority, 'config/product-completeness.json');
});

test('full repository audit includes canonical product-completeness audit', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['audit:full:repo'], /audit:product:completeness/);
});
