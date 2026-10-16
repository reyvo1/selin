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

test('R6 has a load scenario, because its probe cannot be one', () => {
  // The operator named this gap and it is real, and it is WIDER than R6. The release chain has one
  // load gate — `scripts/load-test.mjs --url /api/v1/health` — so the only endpoint proven to survive
  // load anywhere in this repository is the liveness probe. `r6ScaleAi` is a functional probe that
  // calls each route once, in sequence: correct, but silent about speed.
  const r6 = read('tests/load/k6/r6-scale.js');

  // These are R6's actual routes, read out of scripts/ci-r6-scale-ai-probe.mjs rather than guessed.
  // A guessed path 404s, and a 404 satisfies a `< 500` check — the same silent-gap shape this
  // repository keeps closing findings about.
  for (const route of ['/analytics/daily-summaries/materialize', '/analytics/daily-summaries', '/retention/policies', '/retention/archive-runs', '/operator-assistant/query', '/marketplace-orders/import']) {
    assert.ok(r6.includes(route), `R6 scenario must exercise ${route}, the route its functional probe calls`);
  }

  // A latency budget per family, because one aggregate p95 across an aggregation and a warehouse list
  // hides whichever one is slow.
  for (const metric of ['toko360_r6_aggregation_latency', 'toko360_r6_retention_latency', 'toko360_r6_assistant_latency', 'toko360_r6_import_latency']) {
    assert.ok(r6.includes(`new Trend('${metric}'`), `${metric} needs its own trend`);
    assert.match(r6, new RegExp(`'${metric}': \\['p\\(95\\)<`), `${metric} needs a threshold`);
  }

  // A business refusal is not a transport failure. Counting 409 and 422 as errors forces the
  // thresholds to be loosened until a wrong answer looks right.
  assert.ok(r6.includes('toko360_r6_business_rejections'), 'business refusals must be classified apart from errors');
  assert.match(r6, /http_req_failed: \['rate<0\.05'\]/, 'and must not be counted as transport failures');

  // It performs bounded writes, so it must be idempotent per iteration and must say so.
  assert.match(r6, /idempotencyKey: key/, 'each materialize carries its own key');
  assert.ok(r6.includes('Deliberately bounded') || r6.includes('deliberately bounded'), 'the write volume must be called out as bounded, or a run looks like a throughput claim');

  // Reachable by name, and not as the default: the default stays the read scenario.
  assert.match(packageJson.scripts['test:load:k6:r6'], /--scenario r6/, 'the R6 scenario must be runnable by name');
  assert.doesNotMatch(packageJson.scripts['test:load:k6'], /--scenario r6/, 'and must not become the default');
  assert.match(runner, /r6: 'r6-scale\.js'/, 'and the runner must map the name to its file');
});

test('an unknown scenario fails loudly instead of falling back to the read one', () => {
  // A scenario name built as a filename would silently run the read scenario, and a stress run would
  // report a number for a scenario nobody asked for.
  assert.match(runner, /unknown scenario/, 'the runner must reject a name it does not know');
  assert.ok(!runner.includes("scenario === 'write' ? 'checkout-write.js' : 'catalog-read.js'"),
    'the fallback shape must be gone');
});

test("GitHub runs the harness, and the operator's machine never does", () => {
  const workflow = read('.github/workflows/k6-stress.yml');
  const trigger = workflow.slice(0, workflow.indexOf('permissions:'));

  // This is the correction the operator asked for. Dispatch-only meant the harness had never run at
  // all, which is the same failure as the never-run ci.yml job that carried a 92-test failure. The
  // automatic profile runs on GitHub's disposable runner, so it costs the operator nothing.
  assert.match(trigger, /^\s{2}pull_request:/m, 'the default profile must run on pull requests');
  assert.match(trigger, /^\s{2}push:/m, 'and on push to the mainline');
  assert.match(trigger, /workflow_dispatch:/, 'the heavy profile stays available by hand');

  // An automatic run has no `inputs`, so every step must resolve the profile from the resolve step
  // rather than read `inputs.*` directly — otherwise the scenario steps compare against an empty string
  // and skip themselves, and the workflow passes having measured nothing.
  assert.match(workflow, /id: profile/, 'there must be a step that resolves the profile');
  assert.match(workflow, /\$\{\{ github\.event_name \}\}" = "workflow_dispatch"/, 'which distinguishes a manual run from an automatic one');
  assert.match(workflow, /SCENARIO="read"[\s\S]*VUS="\d+"/, 'and supplies a default profile for the automatic path');
  assert.ok(!/if: inputs\.scenario/.test(workflow), 'no step may branch on inputs.scenario directly');

  // The automatic run must own its target. A load test pointed at anything that matters is the thing
  // this harness exists to prevent, so the default target is the API the job starts and seeds itself.
  const example = read('.env.local.example');
  assert.match(example, /^SEED_MODE=demo$/m, 'the disposable instance runs the demo seed, which fixes the admin address');

  assert.match(workflow, /Start a disposable API for an automatic run/, 'an automatic run must bring up its own target');
  assert.match(workflow, /if: github\.event_name != 'workflow_dispatch'/, 'and only the automatic path does that');
  assert.match(workflow, /TARGET="http:\/\/127\.0\.0\.1:4000\/api\/v1"/, 'the automatic target must be the local disposable instance');

  // A load run without a session measures the auth guard, not the query. Minting one is therefore part
  // of the automatic path.
  assert.match(workflow, /Mint a load-test session for an automatic run/, 'an automatic run must have a session');
  assert.match(workflow, /K6_STRESS_TOKEN=\$\{TOKEN\}/, 'the minted token must reach the run');

  // The credential is generated inside the run, for an instance the job owns and destroys. An earlier
  // version asked the operator to configure a secret, which made every automatic run fail until it did;
  // a version before that would have fallen back to the published demo password, which is worse. Both
  // properties are kept: generated per run, and never the published default.
  assert.match(workflow, /openssl rand/, 'the load credential must be generated inside the run');
  assert.match(workflow, /SEED_ADMIN_PASSWORD=\$\{LOAD_PASSWORD\}/, 'and must override the seed password, not inherit it');
  assert.match(workflow, /refusing to authenticate with the published demo password/, 'and must refuse the published default outright');
  // Replacing the line rather than appending a second definition: which duplicate key survives is a
  // dotenv-version detail, and a credential should not depend on one.
  assert.match(workflow, /sed -i '\/\^SEED_ADMIN_PASSWORD=\/d' \.env/, 'the published password must be removed from the file, not just overridden later');
  assert.doesNotMatch(workflow, /example\.invalid/, 'no address may be assumed; the seed decides it');

  // The admin address is whatever `SEED_MODE` in `.env.local.example` actually produces. It is `demo`,
  // and in demo mode `prisma/seed.ts` reads `admin@toko360.local` as a literal and ignores
  // `SEED_ADMIN_EMAIL` entirely — so logging in with any other address is a 401 on every run.
  assert.match(workflow, /SEED_ADMIN_EMAIL="admin@toko360\.local"/, 'the login address must be the one demo mode seeds');
  assert.match(workflow, /SEED_MODE=demo/, 'and the mode this relies on must be named, so a change to the example file breaks the gate');

  // The field names are the application's, not invented: `POST /auth/login` takes `{email, password}`
  // and answers `accessToken`. A rename here would send an empty Authorization header instead of a
  // legible 401, and the run would report a suspiciously fast number.
  assert.match(workflow, /POST "\$\{T360_API_URL\}\/auth\/login"/, 'the login route must be the real one');
  assert.match(workflow, /j\.accessToken/, 'and the token field must be the real one');

  // Production refusal holds on both paths, and the approved-host rule applies to manual runs only,
  // since an automatic run owns its target and has no approved host to match.
  const guard = workflow.slice(workflow.indexOf('Refuse a production-shaped target'), workflow.indexOf('name: Read stress'));
  assert.match(guard, /set -euo pipefail/, 'the guard must run with strict shell options');
  assert.ok((guard.match(/exit 1/g) ?? []).length >= 2, 'every refusal branch must exit non-zero');
  assert.match(guard, /K6_STRESS_ALLOWED_HOST/, 'a manual run must be pinned to an approved host');
  // The pin applies to the manual path only, and the automatic path asserts the opposite instead: that it
  // targets the instance it started. The second execution stopped here, on the approved-host variable
  // being unset, because the pin had been left on both paths.
  assert.match(guard, /github\.event_name \}\}\" != \"workflow_dispatch/, 'the approved-host pin must apply to the manual path only');
  assert.match(guard, /\$\{HOST\}" != "127\.0\.0\.1/, 'and an automatic run must prove it targets the instance it started');
  assert.ok(
    guard.indexOf('K6_STRESS_ALLOWED_HOST') > guard.indexOf('!= "workflow_dispatch"'),
    'the approved-host check must come after the automatic path returns',
  );

  // A superseded pull-request run measures source nobody will ship.
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
    'a new push must supersede the previous PR run, since a manual run against a shared target must not cancel');

  assert.match(workflow, /upload-artifact/, 'evidence must be published');
  assert.match(workflow, /GITHUB_STEP_SUMMARY/, 'and the profile must be shown in the summary, so a number is never read without what it was taken under');
  assert.match(workflow, /no evidence file; a run that produced nothing is not a pass/, 'an empty run must fail the job');
});

test('the catalogue scenario sends the query the till actually sends', () => {
  // `apps/pos/lib/catalog.ts` builds `new URLSearchParams({ limit: String(pageSize) })`, adds `cursor`
  // only when there is one, and `CATALOG_PAGE_SIZE` is 100. There is no `offset` parameter anywhere in
  // the POS client. An earlier version of this scenario used `limit=50` and paged with `offset`, so it
  // measured a query shape the application never issues.
  const catalog = read('tests/load/k6/catalog-read.js');
  assert.match(catalog, /const CATALOG_PAGE_SIZE = 100;/, 'the page size must come from the application, not be chosen here');
  assert.match(catalog, /limit: CATALOG_PAGE_SIZE/, 'and must be used for the catalogue request');
  assert.doesNotMatch(catalog, /offset:/, 'the POS client never sends offset; paging this way measures a query no cashier makes');

  // The walk has to follow `pageInfo.nextCursor`, because a server that ignored the cursor would
  // return page 1 forever and look perfectly healthy.
  assert.match(catalog, /pageInfo'\) \|\| \{\}\)\.nextCursor/, 'the walk must follow pageInfo.nextCursor');
  assert.match(catalog, /cursor is not ignored/, 'and must assert the rows actually change');

  // The search path leaves the client: `searchCatalog` sends `search` to the server because a
  // client-side filter can only search what the device downloaded. That is a different query.
  assert.match(catalog, /search: 'a'/, 'the server-side search path must be exercised');
  assert.ok(catalog.includes("new Trend('toko360_search_latency'"), 'with its own budget');
});

test('the scripts are reachable and named', () => {
  // package.json names a SCENARIO, the runner maps it to a file. Asserting the mapping rather than a
  // filename in package.json is what the runner actually promises, and keeps the npm surface short.
  assert.match(packageJson.scripts['test:load:k6'] || '', /--scenario read/, 'the read scenario must be the default');
  assert.match(packageJson.scripts['test:load:k6:write'] || '', /--scenario write/, 'the write scenario must be reachable, even though it is not the default');
  assert.match(runner, /const SCENARIOS = \{[\s\S]*?read: 'catalog-read\.js'[\s\S]*?write: 'checkout-write\.js'/,
    'the runner must map every scenario name to its file explicitly');
  // The default must be read. A stress default that writes is the whole failure this file exists to prevent.
  assert.doesNotMatch(packageJson.scripts['test:load:k6'], /--allow-writes/, 'the default entry point must not opt into writes');
});
