import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATE_INVENTORY_EXEMPTIONS,
  MECHANISMS,
  MIN_EXEMPTION_RATIONALE,
  classifyEmitter,
  gateInventory,
  inventoryFailures,
} from '../scripts/lib/gate-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emptyContext = { file: 'scripts/x.mjs', workflows: '', summarySource: '', npmScripts: [] };

test('every PASS-emitting script in the repository is bound to a failing gate', () => {
  const { emitters, unclassified } = gateInventory({ root });
  assert.ok(emitters.length >= 28, `expected the measured 28 emitters, found ${emitters.length}`);
  assert.deepEqual(unclassified.map((e) => e.file), [], 'unclassified PASS emitters');
  assert.deepEqual(inventoryFailures({ root }), []);
  for (const emitter of emitters) {
    assert.ok(emitter.mechanisms.length >= 1, `${emitter.file} has no verified mechanism`);
  }
});

test('classification is proven by parsing, not asserted in prose', () => {
  // A file that only shouts PASS is unclassified in an empty context.
  const bare = `export function run() { return { status: 'PASS' }; }\n`;
  assert.deepEqual(classifyEmitter(bare, emptyContext), []);

  // Each mechanism must light up on its own marker and only on that marker.
  const failFast = `const checks={a:true}; for (const [name, passed] of Object.entries(checks)) if (!passed) throw new Error(name); return {status:'PASS',checks};`;
  assert.ok(classifyEmitter(failFast, emptyContext).includes('fail-fast-loop'));

  const throws = `if (a) throw new Error('1'); if (b) throw new Error('2'); if (c) throw new Error('3'); return {status:'PASS'};`;
  assert.ok(classifyEmitter(throws, emptyContext).includes('inline-throws'));
  assert.ok(!classifyEmitter(throws, emptyContext).includes('fail-fast-loop'));

  const assertHelper = `function assert(x,m){ if(!x) throw new Error(m); } assert(1,'a'); assert(2,'b'); assert(3,'c'); return {status:'PASS'};`;
  assert.ok(classifyEmitter(assertHelper, emptyContext).includes('assert-helper'));

  const assertionExport = `export function assertThing(v){ if (!v) throw new Error('bad'); return {status:'PASS'}; }`;
  assert.ok(classifyEmitter(assertionExport, emptyContext).includes('assertion-export'));

  const workflowBound = `return {status:'PASS'};`;
  assert.ok(
    classifyEmitter(workflowBound, { ...emptyContext, workflows: 'run: node scripts/x.mjs' }).includes('workflow-step'),
  );

  const aggregateBound = `write('handoff/quality/x-gate-latest.json'); return {status:'PASS'};`;
  assert.ok(
    classifyEmitter(aggregateBound, { ...emptyContext, summarySource: "readJson(root, 'handoff/quality/x-gate-latest.json')" }).includes('aggregate-gate'),
  );

  // Stripping the validation from a script that had nothing else bound leaves
  // it unclassified - which is exactly what the inventory test must catch.
  assert.deepEqual(classifyEmitter(bare, emptyContext), []);
  assert.deepEqual(MECHANISMS.length, 6);
});

test('an unclassified PASS emitter fails the inventory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't360-gate-inventory-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: {} }));
  fs.writeFileSync(path.join(dir, 'scripts/ci-write-full-system-summary.mjs'), '');
  fs.writeFileSync(path.join(dir, 'scripts/rogue-gate.mjs'), `export const result = { status: 'PASS' };\n`);

  const failures = inventoryFailures({ root: dir });
  assert.equal(failures.length, 1, failures.join('\n'));
  assert.match(failures[0], /scripts\/rogue-gate\.mjs emits PASS without a verified binding/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the exemption set ships empty and demands a real rationale', () => {
  assert.deepEqual(GATE_INVENTORY_EXEMPTIONS, []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't360-gate-inventory-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts/rogue-gate.mjs'), `export const result = { status: 'PASS' };\n`);

  assert.throws(
    () => gateInventory({ root: dir, exemptions: [{ path: 'scripts/rogue-gate.mjs', rationale: 'short' }] }),
    new RegExp(`rationale of at least ${MIN_EXEMPTION_RATIONALE} characters`),
  );
  const allowed = gateInventory({
    root: dir,
    exemptions: [{ path: 'scripts/rogue-gate.mjs', rationale: 'Legacy one-shot promotion probe retired in P6.' }],
  });
  assert.deepEqual(allowed.unclassified, []);
  fs.rmSync(dir, { recursive: true, force: true });
});
