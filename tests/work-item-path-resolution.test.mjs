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
  const directory = workItemFiles('work-items/active')[0];
  assert.ok(directory, 'minimal satu work item aktif harus ada untuk exercise resolver');
  const moved = JSON.parse(readFileSync(`${ROOT}${directory}`, 'utf8'));
  assert.equal(readWorkItem(directory.split('/').pop()).id, moved.id);
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