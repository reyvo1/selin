import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { collectMountFailures, collectSubviewFailures } from '../scripts/lib/admin-contextual-mount.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const map = JSON.parse(read('config/admin-contextual-workflow-map.json'));
const page = read('apps/admin/app/page.tsx');

// A-15 says the UI audit proves handler presence, not workflow completeness. It was demonstrated
// by R2HrConfiguration, which was defined but never rendered, so /people/attendance and
// /people/compliance both showed the payroll lifecycle and all ten panels were unreachable from
// every role. Every gate stayed green because the panel titles and endpoints were present in
// source - presence is not reachability. The per-view reachability tests that would have caught
// it are hand-written one view at a time, so a view that silently unmounts is only caught if
// somebody happened to write a test for that view.
//
// This test is the general control that the per-view tests cannot be. It is derived from the
// map and the page, so it covers a view nobody thought to test.

test('every renderer named by the map is actually mounted in the page', () => {
  assert.equal(map.rows.length, map.expectedContextualViews, 'the map must still describe every view');
  const failures = collectMountFailures(map, page);
  assert.deepEqual(failures, [], `the map must not claim a workflow the page does not render:\n${failures.join('\n')}`);
});

test('every subview the map names is bound as a mode by a callsite that mounts it', () => {
  const failures = collectSubviewFailures(map, page);
  assert.deepEqual(failures, [], `a view that exists but is never selected is unreachable:\n${failures.join('\n')}`);
});

test('the gate fails on a renderer the page does not mount', () => {
  // This is the failure that A-15 was raised on: the map named a component called InventoryLedger
  // for inventory-control/overview and that identifier existed in no file in the repository, while
  // the view shipped as an inline panel under OperationsView. Every gate stayed green.
  const broken = structuredClone(map);
  const overview = broken.rows.find((r) => r.workspace === 'inventory-control' && r.view === 'overview');
  assert.ok(overview, 'inventory-control/overview must still be mapped');
  overview.renderer = 'OperationsView:overview+InventoryLedger';

  const failures = collectMountFailures(broken, page);
  assert.equal(failures.length, 1, 'exactly the phantom renderer must be reported');
  assert.match(failures[0], /InventoryLedger/);
  assert.match(failures[0], /never mounted as JSX/);

  // The subview half of the same row still holds, so a composite renderer must not
  // let a sound subview hide an unsound component.
  assert.deepEqual(collectSubviewFailures(broken, page), [], 'OperationsView:overview is genuinely bound');
});

test('the gate fails on a subview no callsite binds as a mode', () => {
  // OperationsView is bound as a cast union of exactly the five inventory-control views, so it is
  // the component whose subviews the rule can actually constrain. AccountingView cannot be used
  // here: it is mounted once as mode={activeDomainView?.key ?? 'ledger'}, which is dynamic and
  // therefore legitimately reachable for any subview.
  const broken = structuredClone(map);
  const row = broken.rows.find((r) => r.workspace === 'inventory-control' && r.view === 'traceability');
  assert.ok(row, 'inventory-control/traceability must still be mapped');
  assert.equal(row.renderer, 'OperationsView:traceability');
  row.renderer = 'OperationsView:not-a-real-view';

  const failures = collectSubviewFailures(broken, page);
  assert.equal(failures.length, 1, 'exactly the unbound subview must be reported');
  assert.match(failures[0], /not-a-real-view/);
  assert.match(failures[0], /unreachable/);
});

test('a mode-less renderer is self-routing and is not asked which subviews it binds', () => {
  // ManufacturingView is mounted as <ManufacturingView token={token} /> with no mode at all, so it
  // owns its own view switching. Asking the page which modes it binds would invent a contract the
  // code does not have, which is how a gate learns to be ignored.
  const broken = structuredClone(map);
  const row = broken.rows.find((r) => r.workspace === 'manufacturing' && r.view === 'recipes');
  assert.ok(row, 'manufacturing/recipes must still be mapped');
  assert.equal(row.renderer, 'ManufacturingView:recipes');

  assert.deepEqual(collectSubviewFailures(broken, page), [], 'a mode-less renderer must not be asked for a mode union');
});

test('a callsite with a dynamic mode is treated as reachable', () => {
  // <HrPayrollView token={token} mode={activeDomainView?.key ?? 'payroll'} /> is driven by the
  // workspace, so attendance and compliance are bound even though neither string is a literal at
  // the callsite.
  const broken = structuredClone(map);
  const row = broken.rows.find((r) => r.workspace === 'people' && r.view === 'attendance');
  assert.ok(row, 'people/attendance must still be mapped');
  assert.deepEqual(collectSubviewFailures(broken, page), [], 'a dynamic mode callsite must be treated as reachable');
});

test('the real repository has no mount failures', () => {
  assert.deepEqual(collectMountFailures(map, page), [], 'the shipped page must mount every mapped renderer');
  assert.deepEqual(collectSubviewFailures(map, page), [], 'the shipped page must bind every mapped subview');
});
