import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { readWorkItem, resolveWorkItemPath } from './helpers/work-item.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const testsRoot = `${ROOT}tests`;
const literalPattern = /work-items\/(?:active|completed)\/([A-Za-z0-9._-]+\.json)/g;

function testFiles() {
  return readdirSync(testsRoot)
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => `${testsRoot}/${name}`);
}

function workItemFiles(directory) {
  return readdirSync(`${ROOT}${directory}`)
    .filter((name) => name.endsWith('.json'))
    .map((name) => `${directory}/${name}`);
}

test('every work-item file literal in tests resolves to exactly one real work item', () => {
  const dangling = [];
  for (const file of testFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const [, match] of source.matchAll(literalPattern)) {
      try {
        resolveWorkItemPath(match);
      } catch (error) {
        dangling.push(`${file.replace(ROOT, '')} -> ${match}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(dangling, [], `Referensi work item menggantung:\n${dangling.join('\n')}`);
});

test('the shared work-item resolver stays usable after an item moves between directories', () => {
  const active = workItemFiles('work-items/active');
  const completed = workItemFiles('work-items/completed');
  assert.ok(active.length + completed.length > 0, 'active maupun completed boleh kosong sesaat, tetapi repo tidak boleh tanpa work item sama sekali');
  const overlap = active.filter((file) => completed.includes(file));
  assert.deepEqual(overlap, [], `work item tidak boleh berada di active dan completed sekaligus:\n${overlap.join('\n')}`);
  for (const file of [...active, ...completed]) {
    const name = file.split('/').pop();
    const onDisk = JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8'));
    const resolved = resolveWorkItemPath(name);
    assert.equal(resolved, `${ROOT}${file}`, `resolver harus mengembalikan direktori asli ${name}`);
    assert.equal(readWorkItem(name).id, onDisk.id, `${name} harus terbaca sama setelah perpindahan direktori`);
  }
  assert.throws(() => resolveWorkItemPath('T360-00000000-000000-does-not-exist.json'), /tidak ditemukan/);
});

test('all work items, active maupun completed, terbaca tanpa-phase ambigu', () => {
  const files = [...workItemFiles('work-items/active'), ...workItemFiles('work-items/completed')];
  for (const file of files) {
    const name = file.split('/').pop();
    const workItem = readWorkItem(name);
    assert.ok(workItem.id, `work item ${name} harus punya id`);
    assert.ok(workItem.phase, `work item ${name} harus punya phase`);
  }
});