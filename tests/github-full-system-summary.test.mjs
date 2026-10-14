import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectFullSystemSummary, renderMarkdownSummary, writeFullSystemSummary } from '../scripts/ci-write-full-system-summary.mjs';

function copySourceSkeleton(target) {
  for (const entry of ['package.json','package-lock.json','VERSION']) { if (fs.existsSync(entry)) fs.copyFileSync(entry,path.join(target,entry)); }
  for (const dir of ['scripts','tests','config','database','packages','apps','.github']) fs.cpSync(dir,path.join(target,dir),{recursive:true});
}

test('GitHub summary marks missing gates NOT_RUN and stays FAIL', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'t360-ci-summary-'));
  copySourceSkeleton(root);
  const result=collectFullSystemSummary(root,{T360_CI_JOB_STATUS:'failure'});
  assert.equal(result.status,'FAIL');
  assert.equal(result.gates.stage20Automated,'NOT_RUN');
  assert.equal(result.gates.humanUat,'PENDING');
  assert.equal(result.productionTouched,false);
  fs.rmSync(root,{recursive:true,force:true});
});

test('GitHub summary rejects stale current-source evidence instead of reusing PASS', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'t360-ci-summary-'));
  copySourceSkeleton(root);
  const q=path.join(root,'handoff','quality'); fs.mkdirSync(q,{recursive:true});
  fs.writeFileSync(path.join(q,'github-critical-uat-coverage-latest.json'),JSON.stringify({status:'PASS',scenarioCount:12,sourceIdentity:{value:'old-source'}}));
  const result=collectFullSystemSummary(root,{T360_CI_JOB_STATUS:'failure'});
  assert.equal(result.gates.criticalUatCoverage,'STALE');
  assert.equal(result.status,'FAIL');
  fs.rmSync(root,{recursive:true,force:true});
});


test('GitHub summary renders concise gate diagnostics without claiming human UAT', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'t360-ci-summary-'));
  copySourceSkeleton(root);
  const result=collectFullSystemSummary(root,{T360_CI_JOB_STATUS:'failure'});
  const markdown=renderMarkdownSummary(result);
  assert.match(markdown, /Toko360 Full-System Simulation/);
  assert.match(markdown, /Human Stage-20 UAT/);
  assert.match(markdown, /PENDING/);
  assert.match(markdown, /Production touched:\*\* false/);
  fs.rmSync(root,{recursive:true,force:true});
});

test('GitHub summary appends markdown to GITHUB_STEP_SUMMARY when requested', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'t360-ci-summary-'));
  copySourceSkeleton(root);
  const stepSummary=path.join(root,'step-summary.md');
  const output='handoff/quality/test-github-summary.json';
  const { result, target }=writeFullSystemSummary(root,{T360_CI_JOB_STATUS:'failure',GITHUB_STEP_SUMMARY:stepSummary,T360_CI_SUMMARY_OUTPUT:output},output);
  assert.equal(result.status,'FAIL');
  assert.ok(fs.existsSync(target));
  assert.match(fs.readFileSync(stepSummary,'utf8'),/Evidence gates/);
  fs.rmSync(root,{recursive:true,force:true});
});

test('A-02: a checks-based gate fails when checks is empty instead of passing vacuously', async () => {
  const { sourceFingerprint } = await import('../scripts/lib/source-fingerprint.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 't360-ci-summary-'));
  copySourceSkeleton(root);
  const current = sourceFingerprint(root).value;
  const q = path.join(root, 'handoff', 'quality');
  fs.mkdirSync(q, { recursive: true });
  const gates = {
    r2HrPayroll: 'github-r2-hr-payroll-probe-latest.json',
    r4CoreBusiness: 'github-r4-core-business-probe-latest.json',
    r5AssetsFleet: 'github-r5-assets-fleet-probe-latest.json',
    r6ScaleAi: 'github-r6-scale-ai-probe-latest.json',
    r3Residual: 'github-r3-residual-probe-latest.json',
    p3Productization: 'github-p3-productization-probe-latest.json',
  };
  // Every field the predicate needs except the checks themselves: PASS with an
  // empty object used to satisfy Object.values(...).every(Boolean), because
  // [].every(Boolean) is true.
  for (const [gate, file] of Object.entries(gates)) {
    const fixture = { status: 'PASS', sourceIdentity: { value: current }, checks: {} };
    if (gate === 'p3Productization') fixture.productionTouched = false;
    fs.writeFileSync(path.join(q, file), JSON.stringify(fixture));
  }
  const result = collectFullSystemSummary(root, { T360_CI_JOB_STATUS: 'failure' });
  for (const gate of Object.keys(gates)) {
    assert.equal(result.gates[gate], 'FAIL', `${gate} must reject empty checks, got ${result.gates[gate]}`);
  }

  // And the same evidence with a real check passes that predicate, so the fix
  // raised the bar without breaking the happy path.
  fs.writeFileSync(path.join(q, 'github-r2-hr-payroll-probe-latest.json'), JSON.stringify({
    status: 'PASS', sourceIdentity: { value: current }, checks: { attendance: true },
  }));
  const second = collectFullSystemSummary(root, { T360_CI_JOB_STATUS: 'failure' });
  assert.equal(second.gates.r2HrPayroll, 'PASS');
  fs.rmSync(root, { recursive: true, force: true });
});
