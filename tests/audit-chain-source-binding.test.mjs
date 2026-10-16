// `audit:full:repo` is a chain of six audits, and one of them writes files that the source
// fingerprint covers.
//
// The fingerprint hashes the CONTENT of tracked files under `apps`, `packages`, `database`, `scripts`,
// `tests`, `config`, `.github/workflows` and a few root files. `scripts/audit-ui-domain-surface-depth.mjs`
// — the last step of the P5 audit — rewrites `config/p5-full-ui-root-audit.json`, which is tracked and
// inside that set. `scripts/audit-full-repository.mjs` — the FIRST step — records the fingerprint into
// its evidence file.
//
// So on any run where the UI changed, the first audit recorded one fingerprint, the last audit changed
// the tree, and every later gate recorded the new one. At the end, `ci-write-full-system-summary.mjs`
// compared the repositoryAudit evidence against the current source, found them different, and marked
// the gate STALE — which fails the whole release gate.
//
// It is not a false alarm in the sense of being wrong: the evidence really was produced against a
// different tree. It is a false alarm in the sense that nothing regressed. It surfaced here only
// because this branch's UI work changed the control counts, which is exactly the case that would have
// blocked any UI release.
//
// The fix is ordering: regenerate the derived ledger FIRST, then measure. These tests pin that order,
// and pin the property that made it necessary, so the two cannot drift apart again.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const chain = packageJson.scripts['audit:full:repo'];

test('the chain regenerates derived ledgers before anything records a fingerprint', () => {
  const writerAt = chain.indexOf('audit:p5:visual');
  const recorderAt = chain.indexOf('scripts/audit-full-repository.mjs');
  assert.ok(recorderAt > 0, 'the recording audit must still be in the chain');
  assert.ok(writerAt > 0, 'the P5 audit must still be in the chain');
  assert.ok(
    writerAt < recorderAt,
    'the P5 audit rewrites config/p5-full-ui-root-audit.json, a tracked file inside the fingerprint set. ' +
      'It has to run BEFORE the audit that records a fingerprint, or that evidence is bound to a tree ' +
      'the chain itself then modifies and the release gate marks STALE.',
  );
});

test('the writer really does write a tracked, fingerprinted path', () => {
  // The ordering above is only meaningful while this is true. If the writer were ever moved into
  // handoff/quality (which is gitignored), the order would stop mattering and the test above would be
  // guarding nothing. Assert the coupling rather than assuming it.
  const writer = read('scripts/audit-ui-domain-surface-depth.mjs');
  assert.match(writer, /writeFileSync\(path\.join\(root, 'config', 'p5-full-ui-root-audit\.json'\)/,
    'the P5 audit writes config/p5-full-ui-root-audit.json');

  const fingerprint = read('scripts/lib/source-fingerprint.mjs');
  assert.match(fingerprint, /'config'/, 'config/ is inside the fingerprint set');
  assert.match(fingerprint, /'ls-files'/, 'and the set is the TRACKED files, so a tracked config file is covered');
});
