// A stress test is the easiest thing in this repository to point at the wrong server, and the damage
// is not a bad graph — it is real sales, real journal entries and real stock movements written as fast
// as the connection allows. These tests pin the refusals that make that impossible.
//
// They are deliberately source-contract rather than behavioural. Running a load scenario inside the
// dependency-free suite would itself be a load test on the machine running CI, and asserting that k6
// "would refuse" by actually invoking k6 would mean the suite depends on a Go binary being present.
// What matters is that the refusal exists, is written against the target host itself rather than a
// flag the caller controls, and that the write scenario opts in deliberately.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const runner = read('scripts/run-k6-stress.mjs');
const readScenario = read('tests/load/k6/catalog-read.js');
const writeScenario = read('tests/load/k6/checkout-write.js');
const packageJson = JSON.parse(read('package.json'));

test('the runner refuses a production-shaped target before it connects', () => {
  // The forbidden list is data, so assert its shape rather than re-escaping each pattern here: a
  // previous version of this test built a RegExp per label and then failed to match the very source
  // it was checking, because the label in the source carries its own backslash.
  const forbidden = runner.slice(runner.indexOf('const FORBIDDEN'), runner.indexOf('];', runner.indexOf('const FORBIDDEN')));
  for (const label of ['prod', 'production', 'live', 'toko360']) {
    assert.ok(forbidden.includes(label), `the runner must recognise a ${label} target`);
  }
  assert.equal((forbidden.match(/\{ re:/g) ?? []).length, 4, 'all four refusal patterns must be present');
  // The refusal has to be a refusal, not a warning nobody reads. Asserted on behaviour rather than
  // on wording: an earlier version matched a phrase and then failed because the message said
  // "creates" where the test looked for "create".
  const forbiddenBranch = runner.slice(runner.indexOf('for (const { re, why } of FORBIDDEN)'), runner.indexOf('if (!allowNonproduction)'));
  assert.match(forbiddenBranch, /fail\(/, 'a production-shaped hostname must call fail()');
  assert.match(runner, /function fail\(message, code = 2\)[\s\S]*process\.exit\(code\)/, 'fail() must exit, and non-zero by default');
  assert.match(forbiddenBranch, /fail\(`\$\{target\.hostname\}/, 'the message must name the host it refused, so the operator knows which server to check');
  // Checked against the hostname, not the whole URL: a path or a query cannot smuggle a target past it.
  assert.match(runner, /target\.hostname/, 'the refusal must read the parsed hostname');
});

test('the write scenario refuses for itself, without depending on the runner', () => {
  // The scenario can be run with `k6 run` directly. If its safety lived only in the wrapper, one
  // direct invocation would write to production.
  assert.match(writeScenario, /FORBIDDEN_HOST/, 'the scenario must carry its own host pattern');
  assert.match(writeScenario, /new URL\(BASE\)\.hostname/, 'and must check the parsed host');
  assert.match(writeScenario, /fail\(`REFUSING/, 'and must fail the run, not just set a metric');

  // Opt-in is explicit and separate from the host check: a staging copy is not refused by name, so
  // the decision to write real rows must be its own act.
  assert.match(writeScenario, /ALLOW_WRITES === 'yes'/, 'writes must be opt-in');
  assert.match(writeScenario, /ALLOW_WRITES is not "yes"/, 'and the opt-in must be named in the refusal');
  assert.match(writeScenario, /TOKEN is required/, 'a write run without a session cannot be tenant-scoped and must not proceed');
});

test('every write carries its own operation key, and the replay is asserted', () => {
  // Without a per-iteration key the generator's own retries duplicate sales, and with `npm test` also
  // running `npm run test --workspaces`, a duplicated sale is a duplicated journal.
  assert.match(writeScenario, /const key = `k6-\$\{__VU\}-\$\{__ITER\}`/, 'each iteration needs a unique key');
  for (const header of ['Idempotency-Key', 'X-Operation-Key']) {
    assert.ok(writeScenario.includes(`'${header}'`), `${header} must travel with the request`);
  }
  // The header alone is not enough — whichever one the deployment reads, the body carries it too.
  assert.match(writeScenario, /idempotencyKey: key/, 'the key must also be in the body');
  // And the file must actually replay the key and check the sale number is unchanged. Without that
  // the idempotency claim is decorative.
  assert.match(writeScenario, /replay returns the ORIGINAL sale number/, 'the replay must be asserted, not assumed');
  assert.match(writeScenario, /toko360_idempotency_violations': \['rate==0'\]/, 'and a broken replay must fail the threshold');
});

test('the read scenario measures what actually breaks under pressure', () => {
  // `scripts/load-test.mjs` already exists and points at one URL — by default /health. A liveness
  // probe under load proves the process answers; it does not prove a paginated list with a filter
  // holds up, which is the thing AGENTS.md actually obliges.
  assert.match(readScenario, /\/products/, 'the catalogue read must be exercised');
  assert.match(readScenario, /cursor|offset/, 'pagination must be exercised, not just page one');
  assert.match(readScenario, /reports\//, 'aggregation-backed reads must be exercised');
  // Ramping arrival, because a cashier count does not appear all at once.
  assert.match(readScenario, /stages: \[/, 'the scenario must ramp rather than open with a wall');
  // A named Trend so a slow endpoint is visible instead of averaged away.
  assert.ok(readScenario.includes("new Trend('toko360_catalog_latency'"), 'catalog latency needs its own trend');
});

test('thresholds live in the scenario, so the gate cannot be passed by ignoring the output', () => {
  assert.match(readScenario, /thresholds: \{[\s\S]*checks: \['rate>0\.99'\]/, 'a broken check must fail the run');
  assert.match(readScenario, /http_req_duration: \['p\(95\)<800'/, 'a latency budget must exist');
  assert.match(readScenario, /toko360_unauthorized': \['rate==0'\]/, 'an authorization failure under load is a breach, not noise');
});

test('the runner records evidence and cannot report PASS for a run that did nothing', () => {
  assert.match(runner, /k6-\$\{scenario\}-latest\.json/, 'evidence must be written next to the other gates');
  assert.ok(runner.includes('requestCount > 0'), 'a run with zero requests must not report PASS');
  assert.match(runner, /thresholdFailures/, 'broken thresholds must be surfaced, not swallowed');
  // The pre-flight exists so a failed run explains itself instead of blaming the load generator.
  assert.match(runner, /sourceFingerprint/, 'the runtime identity must be recorded with the number');
  assert.match(runner, /does not match the expected/, 'and a mismatch must stop the run, because a number for different source proves nothing');
});

test('a heavy profile cannot be aimed at a workstation by accident', () => {
  // The first real run of this harness used 10 VUs for 75 seconds against a development-mode API on
  // the operator's laptop and froze the machine. The number was not the problem; the target was. A
  // laptop is also running the editor, the browser and the operator, so a load number taken there
  // describes the laptop rather than the application.
  assert.match(runner, /VUS_CEILING/, 'the runner must have a ceiling');
  assert.match(runner, /requestedVus > VUS_CEILING && !flag\('allow-heavy'\)/, 'and exceeding it must stop the run');
  assert.match(runner, /measure that machine|measures that machine/, 'the refusal must say why, so nobody raises the ceiling without reading it');

  // The default has to be a smoke profile. A default that freezes someone's computer is a default
  // nobody should keep.
  const defaultVus = runner.match(/argument\('vus', process\.env\.VUS \|\| '(\d+)'\)/);
  assert.ok(defaultVus, 'the runner must have a readable default VU count');
  assert.ok(Number(defaultVus[1]) <= 4, `the default is ${defaultVus[1]} VUs, which is not a smoke profile`);
  const hold = runner.match(/argument\('duration', process\.env\.DURATION \|\| '(\d+s)'\)/);
  assert.ok(hold && Number(hold[1].replace('s', '')) <= 30, 'the default hold must be short');

  // The profile must be recorded, or a number cannot be read without knowing what it was taken under.
  assert.match(runner, /profile: \{/, 'the evidence must carry the profile');
  for (const field of ['vus', 'rampSeconds', 'durationSeconds']) {
    assert.match(runner, new RegExp(field), `the profile must record ${field}`);
  }
});

test('the heavy profile runs on a GitHub runner, never on a push or a pull request', () => {
  const workflow = read('.github/workflows/k6-stress.yml');
  // Dispatch-only is the whole mechanism. A `push` or `pull_request` trigger would let an ordinary
  // commit start a load run on whatever machine the runner lands on.
  const triggerBlock = workflow.slice(0, workflow.indexOf('permissions:'));
  assert.ok(!/^\s{2}push:/m.test(triggerBlock), 'the stress workflow must not trigger on push');
  assert.ok(!/^\s{2}pull_request:/m.test(triggerBlock), 'the stress workflow must not trigger on pull_request');
  assert.match(triggerBlock, /workflow_dispatch:/, 'it must be manually dispatched');

  // The runner must refuse a production-shaped target on CI too, not only locally.
  assert.match(workflow, /production|prod/, 'CI must refuse a production-shaped host');
  assert.match(workflow, /K6_STRESS_ALLOWED_HOST/, 'and the approved host must be an explicit repository variable, not any host');
  const guard = workflow.slice(workflow.indexOf('Refuse a production-shaped target'), workflow.indexOf('name: Read stress'));
  assert.match(guard, /set -euo pipefail/, 'the guard step must run with strict shell options, or a failure does not stop it');
  assert.ok((guard.match(/exit 1/g) ?? []).length >= 3, 'every refusal branch must exit non-zero, not only log');
  assert.match(guard, /::error::/, 'and must mark the job failed where a reader will see it');

  // Two concurrent load runs against one target measure each other's load.
  assert.match(workflow, /^concurrency:/m, 'concurrency must be pinned');

  // A run that produced nothing is not a pass, and the evidence must reach the run summary so a
  // reviewer reads the numbers rather than a green tick.
  assert.match(workflow, /upload-artifact/, 'evidence must be published');
  assert.match(workflow, /GITHUB_STEP_SUMMARY/, 'and shown in the job summary');
  assert.match(workflow, /no evidence file; a run that produced nothing is not a pass/, 'an empty run must fail the job');
});

test('the scripts are reachable and named', () => {
  // package.json names a SCENARIO, the runner maps it to a file. Asserting the mapping rather than a
  // filename in package.json is what the runner actually promises, and keeps the npm surface short.
  assert.match(packageJson.scripts['test:load:k6'] || '', /--scenario read/, 'the read scenario must be the default');
  assert.match(packageJson.scripts['test:load:k6:write'] || '', /--scenario write/, 'the write scenario must be reachable, even though it is not the default');
  assert.match(runner, /scenario === 'write' \? 'checkout-write\.js' : 'catalog-read\.js'/, 'and the runner must map both scenario names to their files');
  // The default must be read. A stress default that writes is the whole failure this file exists to prevent.
  assert.doesNotMatch(packageJson.scripts['test:load:k6'], /--allow-writes/, 'the default entry point must not opt into writes');
});
