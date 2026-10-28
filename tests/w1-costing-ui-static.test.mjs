import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = 'apps/admin/app/modules/inventory-costing.tsx';
const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('inventory costing UI imports shared auth, permission, and UI primitives', () => {
  assert.match(src, /import\s+\{\s*authFetch\s*\}\s+from\s+'..\/auth-fetch'/);
  assert.match(src, /import\s+\{\s*usePermissions\s*\}\s+from\s+'..\/permissions'/);
  assert.match(src, /import\s+\{[^}]*Panel[^}]*Table[^}]*\}\s+from\s+'..\/ui'/);
  assert.match(src, /export default function InventoryCostingView/);
});

test('inventory costing UI uses inventory costing permissions', () => {
  assert.match(src, /inventory\.costing\.view/);
  assert.match(src, /inventory\.costing\.manage/);
  assert.match(src, /inventory\.costing\.rebuild/);
});

test('inventory costing UI calls required backend endpoints', () => {
  for (const endpoint of [
    '/inventory/costing/policies',
    '/inventory/costing/policies/${id}/activate',
    '/inventory/costing/valuation',
    '/inventory/costing/layers',
    '/inventory/costing/reconciliation',
    '/inventory/costing/rebuild',
    '/inventory/costing/rebuild-runs',
    '/inventory/costing/rebuild-runs/${id}',
  ]) {
    assert.ok(src.includes(endpoint.replace('${id}', '${id}')), `${endpoint} missing`);
  }
});

test('inventory costing UI covers policy, valuation, layers, reconciliation, and rebuild', () => {
  assert.match(src, /createPolicy/);
  assert.match(src, /activatePolicy/);
  assert.match(src, /loadValuation/);
  assert.match(src, /loadLayers/);
  assert.match(src, /loadReconciliation/);
  assert.match(src, /requestRebuild/);
  assert.match(src, /loadRebuildRun/);
});
