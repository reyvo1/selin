import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = path.join(root, 'scripts', 'workflow.mjs');

function run(args, cwd = root) {
  const result = spawnSync(process.execPath, [workflow, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout || ''}${result.stderr || ''}` };
}

/**
 * W-01. commandAdvance only rejected a phase whose order was lower than the current
 * one, so a work item could jump STAGING -> RELEASED -> CLOSED and never pass
 * RELEASE_READY, whose releaseEvidence check therefore never ran. Demonstrated
 * live while closing T360-20261014-131512: that item went STAGING -> RELEASED ->
 * CLOSED and its releaseEvidence array had to be backfilled after the fact. A gate
 * that can be bypassed by skipping the step that would have enforced it is not a
 * gate. The rule is now derived from config/workflow-policy.json phaseOrder: a
 * non-BLOCKED advance must land on the immediate successor, BLOCKED remains
 * reachable from anywhere and remains a dead end, and RELEASE_READY keeps its
 * releaseEvidence check so that every path to CLOSED now passes through it.
 */
test('workflow:advance rejects a skipped phase, a backward phase, and an unbacked RELEASE_READY', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't360-phase-'));
  fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'work-items', 'active'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'work-items', 'completed'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'handoff', 'release-evidence'), { recursive: true });
  fs.cpSync(path.join(root, 'config'), path.join(tmp, 'config'), { recursive: true });

  const now = new Date().toISOString();
  const scratch = {
    id: 'T360-20261014-000000',
    title: 'scratch item used to prove the phase-order rule',
    type: 'bug',
    module: 'workflow',
    wave: 'W0',
    phase: 'STAGING',
    risk: 'LOW',
    owner: 'openai',
    featureFlag: '',
    dependencies: [],
    impacts: { database: 'NONE', inventory: 'NONE', accounting: 'NONE', tax: 'NONE', payment: 'NONE', payroll: 'NONE', sync: 'NONE', security: 'NONE', performance: 'NONE' },
    businessRules: ['Scratch item used only to prove workflow:advance rejects a skipped phase; it is not a real work item.'],
    acceptanceCriteria: ['workflow:advance rejects a jump from STAGING straight to RELEASED.'],
    testPlan: ['The test itself is the plan.'],
    migrationPlan: 'No database change; scratch item only.',
    rollbackPlan: 'Delete the scratch directory; nothing else changes.',
    monitoringPlan: 'Not monitored; scratch item only.',
    securityNotes: 'Scratch item used only to prove the phase-order rule.',
    documentation: [],
    createdAt: now,
    updatedAt: now,
    releaseEvidence: []
  };
  const scratchPath = path.join(tmp, 'work-items', 'active', 'T360-20261014-000000-scratch.json');
  const writeScratch = () => fs.writeFileSync(scratchPath, `${JSON.stringify(scratch, null, 2)}\n`);
  writeScratch();

  const skip = run(['advance', 'T360-20261014-000000', 'RELEASED'], tmp);
  assert.notEqual(skip.code, 0, 'STAGING -> RELEASED must be rejected');
  assert.match(skip.out, /melompat/);
  assert.match(skip.out, /RELEASE_READY/, 'the error must name the phase that was skipped over');

  const noEvidence = run(['advance', 'T360-20261014-000000', 'RELEASE_READY'], tmp);
  assert.notEqual(noEvidence.code, 0, 'RELEASE_READY must still require releaseEvidence');
  assert.match(noEvidence.out, /releaseEvidence/);

  scratch.releaseEvidence = ['handoff/release-evidence/T360-20261014-000000-proof.md'];
  writeScratch();
  fs.writeFileSync(path.join(tmp, 'handoff', 'release-evidence', 'T360-20261014-000000-proof.md'), '# proof\n');

  const ok = run(['advance', 'T360-20261014-000000', 'RELEASE_READY'], tmp);
  assert.equal(ok.code, 0, `RELEASE_READY must succeed once releaseEvidence resolves: ${ok.out}`);

  scratch.phase = 'RELEASE_READY';
  writeScratch();
  const back = run(['advance', 'T360-20261014-000000', 'STAGING'], tmp);
  assert.notEqual(back.code, 0, 'RELEASE_READY -> STAGING must be rejected');
  assert.match(back.out, /mundur/);

  scratch.phase = 'STAGING';
  writeScratch();
  const blocked = run(['advance', 'T360-20261014-000000', 'BLOCKED'], tmp);
  assert.equal(blocked.code, 0, `any phase may enter BLOCKED: ${blocked.out}`);

  scratch.phase = 'BLOCKED';
  writeScratch();
  const fromBlocked = run(['advance', 'T360-20261014-000000', 'VERIFICATION'], tmp);
  assert.notEqual(fromBlocked.code, 0, 'BLOCKED is a dead end');
  assert.match(fromBlocked.out, /dead end/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the workflow CLI still validates the repository work items', () => {
  const validate = run(['validate']);
  assert.equal(validate.code, 0, validate.out);
  assert.match(validate.out, /Workflow validation passed/);
});
