import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectRoutes,
  collectSiblingInconsistencies,
  FLAG_IDENTITY,
  lineCoversRoute,
  normalizePath,
} from '../scripts/lib/frontend-endpoint-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ledger = JSON.parse(read('config/frontend-endpoint-coverage-baseline.json'));

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a17-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

test('the measured set equals the reviewed ledger, in both directions', () => {
  const measured = collectSiblingInconsistencies(root);
  const actual = measured.flagged.map(FLAG_IDENTITY).sort();
  const expected = ledger.entries.map((e) => e.id).sort();
  assert.deepEqual(
    actual.filter((id) => !expected.includes(id)),
    [],
    'an endpoint became unreachable while a sibling stayed reachable, and the ledger does not review it',
  );
  assert.deepEqual(
    expected.filter((id) => !actual.includes(id)),
    [],
    'the ledger reviews an endpoint that is no longer flagged; drop the stale entry',
  );
  assert.deepEqual(actual, expected);
});

test('every ledger entry states a basis and uses a declared class', () => {
  const classes = new Set(Object.keys(ledger.classes ?? {}));
  for (const entry of ledger.entries) {
    assert.ok(classes.has(entry.class), `${entry.id} uses undeclared class ${entry.class}`);
    assert.ok(
      typeof entry.reason === 'string' && entry.reason.trim().length >= 40,
      `${entry.id} carries no stated basis; an exception without one is not a review`,
    );
    assert.ok(entry.controller.endsWith('.controller.ts'), `${entry.id} names a non-controller ${entry.controller}`);
  }
});

/**
 * The anti-silencing rule, and it is derived rather than listed. @Roles names
 * the human who may call an endpoint, so an endpoint behind @Roles is
 * human-facing by construction; filing one as node protocol, device ingest or
 * a provider callback would reclassify a missing screen as an architecture
 * decision. Without this, the cheapest way to make the audit green again is to
 * edit the class of whatever the audit just found.
 */
test('an endpoint behind @Roles cannot be filed as anything but a UI gap', () => {
  const guards = new Map(collectRoutes(root).map((r) => [FLAG_IDENTITY(r), r]));
  for (const entry of ledger.entries) {
    const route = guards.get(entry.id);
    assert.ok(route, `${entry.id} is in the ledger but declared by no controller`);
    if (route.roles) {
      assert.equal(
        entry.class,
        'UI_GAP',
        `${entry.id} is guarded by @Roles(${route.roles}) and is human-facing; it may not be filed as ${entry.class}`,
      );
    }
  }
});

test('a controller no UI reaches at all is an API-only surface and flags nothing', () => {
  const dir = fixture({
    'apps/api/src/demo/demo.controller.ts': `
      import { Controller, Get, Post } from '@nestjs/common';
      @Controller('demo')
      export class DemoController {
        @Get('hook-a') a() {}
        @Post('hook-b') b() {}
      }
    `,
    'apps/admin/app/page.tsx': `export default function Page() { return null; }`,
  });
  const { flagged, controllers } = collectSiblingInconsistencies(dir);
  assert.deepEqual(flagged.map(FLAG_IDENTITY), []);
  assert.equal(controllers[0].uniform, 'NONE_REACHED');
});

test('one unreachable endpoint beside a reachable sibling is flagged', () => {
  const dir = fixture({
    'apps/api/src/demo/demo.controller.ts': `
      import { Controller, Get, Post } from '@nestjs/common';
      @Controller('demo')
      export class DemoController {
        @Get('list') list() {}
        @Post('list/:id/archive') archive() {}
        @Post('list/:id/destroy') destroy() {}
      }
    `,
    'apps/admin/app/page.tsx': `
      export async function load() { return api('/demo/list'); }
      export async function archive(id: string) { return api(\`/demo/list/\${id}/archive\`, { method: 'POST' }); }
    `,
  });
  const { flagged } = collectSiblingInconsistencies(dir);
  assert.deepEqual(flagged.map(FLAG_IDENTITY), ['POST /demo/list/:id/destroy']);
});

test('a path assembled from a ternary on one line still counts as reachable', () => {
  // hr-payroll.tsx:681 in the real repository, reduced. Exact matching alone
  // reported both approvers unreachable while a user was clicking them.
  // lineCoversRoute takes a NORMALISED route, as collectRoutes returns it.
  const route = normalizePath('/payroll/tax-rule-sets/:id/approve');
  const line = "await api(`${kind==='tax'?'/payroll/tax-rule-sets':'/payroll/social-security-rule-sets'}/${rule.id}/approve`,{method:'POST'});";
  const SEG = String.raw`(?:[A-Za-z0-9_.@-]+|\$\{[^}]*\}|:[A-Za-z0-9_]+)+`;
  const tokenRe = new RegExp(String.raw`(?<![A-Za-z0-9_/.:-])(\/${SEG}(?:\/${SEG})*)(?![A-Za-z0-9_])`, 'g');
  const tokens = [...line.matchAll(tokenRe)].map((m) => normalizePath(m[1]));
  assert.ok(tokens.includes('/payroll/tax-rule-sets'), 'the literal half of the ternary must be a token');
  assert.ok(lineCoversRoute(route, tokens), 'prefix and suffix on one line must cover the route');
});

test('a bare interpolation on one line does not reach unrelated routes', () => {
  // domain-workspaces.ts:122 in the real repository, reduced. That line is
  // `return \`${workspace.route}/${view.key}\`;` and yields exactly one token,
  // `/:p`. Under two-way param leniency that single token covered eleven
  // unrelated endpoints as prefix and suffix, so one line of route-building
  // told the audit that branch-continuity, edge-sync and platform were all
  // reachable.
  const bare = ['/:p'];
  assert.equal(lineCoversRoute(normalizePath('/branch-continuity/connectivity'), bare), false);
  assert.equal(lineCoversRoute(normalizePath('/edge-sync/pull'), bare), false);
  assert.equal(lineCoversRoute(normalizePath('/platform/automation-jobs/:id'), bare), false);
  assert.equal(
    lineCoversRoute(normalizePath('/users/:id/edit'), ['/users', '/:p/edit']),
    true,
    'a param token still covers a param segment when the literals around it are present',
  );
});

test('the ledger does not grow silently: a new dead sibling fails the run', () => {
  const measured = collectSiblingInconsistencies(root);
  const withoutLast = ledger.entries.slice(0, -1).map((e) => e.id);
  const missing = measured.flagged.map(FLAG_IDENTITY).filter((id) => !withoutLast.includes(id));
  assert.ok(missing.length >= 1, 'removing a reviewed entry must surface the endpoint again');
});

/**
 * A client that builds a path by concatenation was invisible to this control.
 *
 * `api('/mobile-ops/drafts/' + encodeURIComponent(draft.id) + '/scan')` produces two separate tokens
 * with nothing standing for the parameter between them, so the route measured as unreachable while the
 * stock-count screen was calling it in front of us. Two endpoints had been filed as UI_GAP on the
 * strength of that measurement, and a UI_GAP sends someone to build a screen that already exists.
 *
 * The fix lets an interpolation cover PARAMETER segments between two covered runs. The restriction to
 * parameters is the safety argument, so each half of it is pinned here.
 */

test('an interpolated parameter between two covered runs counts as covered', () => {
  const tokens = ['/mobile-ops/drafts', '/scan'];
  assert.ok(!lineCoversRoute('/mobile-ops/drafts/:draftId/scan', tokens), 'without the flag the parameter is uncovered, which is why the endpoint was flagged in the first place');
  assert.ok(
    lineCoversRoute('/mobile-ops/drafts/:draftId/scan', tokens, { interpolated: true }),
    'a line that concatenates around an interpolation covers the parameter it skipped',
  );
});

test('an interpolation cannot invent a LITERAL segment of the route', () => {
  // This is the half that would be dangerous if it broke. If the gap could cover a literal, then a
  // line mentioning '/mobile-ops/drafts' and '/scan' would certify /mobile-ops/drafts/export/scan and
  // anything else sharing that prefix — which is exactly what the `:p` rule exists to prevent.
  const tokens = ['/mobile-ops/drafts', '/scan'];
  assert.ok(
    !lineCoversRoute('/mobile-ops/drafts/export/scan', tokens, { interpolated: true }),
    'a literal segment must still have to appear as its own token',
  );
  assert.ok(!lineCoversRoute('/mobile-ops/drafts/export/scan', tokens), 'and it must not pass without the flag either');
});

test('two paths merely mentioned on one line do not certify a route between them', () => {
  // Without the `interpolated` flag the parameter is never covered, so listing two sibling paths on
  // one line — a very common shape in a route table or a test — cannot manufacture reachability.
  const tokens = ['/mobile-ops/drafts', '/scan'];
  assert.ok(!lineCoversRoute('/mobile-ops/drafts/:draftId/scan', tokens), 'no flag, no coverage');
  // And the flag only means "this line concatenated", not "this line is a path builder for anything".
  assert.ok(!lineCoversRoute('/payments/:id/refunds', tokens, { interpolated: true }), 'the rule is per-route, not per-line');
});
