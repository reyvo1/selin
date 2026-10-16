#!/usr/bin/env node
/**
 * Run a k6 scenario against a Toko360 API and record what was observed.
 *
 * WHAT THIS ADDS OVER `k6 run`, which is why it exists at all:
 *
 *   1. A refusal. A stress run against a production-shaped host is a way to corrupt a ledger at
 *      speed. The refusal lives here AND inside each scenario, because a scenario can be run directly
 *      and must not depend on the wrapper for its own safety.
 *   2. Evidence. k6 writes a summary; this turns it into the same shape as every other gate in this
 *      repository, so a run can be compared against a claim rather than read as prose.
 *   3. An honest exit. k6 already fails its own process on a broken threshold. This does NOT relax
 *      that: it treats a broken threshold as FAIL and additionally refuses to report PASS when the
 *      run did not actually exercise anything.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const scenario = argument('scenario', 'read');
const baseUrl = argument('base-url', 'http://127.0.0.1:4000/api/v1');
const SCENARIOS = {
  read: 'catalog-read.js',
  r6: 'r6-scale.js',
  write: 'checkout-write.js',
};
const scenarioFile = SCENARIOS[scenario];
if (!scenarioFile) {
  fail(`unknown scenario '${scenario}'. Known: ${Object.keys(SCENARIOS).join(', ')}`);
}
const scriptPath = path.join(ROOT, 'tests/load/k6', scenarioFile);
const outputPath = path.join(ROOT, 'handoff/quality', `k6-${scenario}-latest.json`);
const expectedSource = argument('expected-source-fingerprint', '');
const expectedDbHost = argument('expected-db-host', '');
const expectedDbName = argument('expected-db-name', '');
const keepArtifacts = flag('keep-artifacts');

/** Hosts a stress run must never touch. Matching is on the hostname, not the whole URL. */
const FORBIDDEN = [
  { re: /(^|[.-])prod([.-]|$)/i, why: 'hostname contains a prod label' },
  { re: /(^|[.-])production([.-]|$)/i, why: 'hostname contains a production label' },
  { re: /(^|[.-])live([.-]|$)/i, why: 'hostname contains a live label' },
  { re: /(^|\.)toko360\.com$/i, why: 'hostname is the production apex domain' },
];

/**
 * A target the operator has explicitly declared disposable.
 *
 * Without this the only safe default is "refuse everything", which would make the tool unusable and
 * therefore never run. `--allow-nonproduction` is the acknowledgement that a load run creates real
 * rows, and it is deliberately spelled out rather than inferred from a hostname.
 */
const allowNonProduction = flag('allow-nonproduction');

/**
 * A ceiling on the virtual-user count a single run may ask for.
 *
 * This exists because the first real run of this harness used 10 VUs for 75 seconds against a
 * development-mode API on the operator's laptop and froze the machine. The mistake was not the
 * number, it was the target: a load number from a laptop that is also running the editor and the
 * browser describes the laptop, not the application. So the limit here is a backstop against a
// future copy-paste, and the capacity profile belongs on a dedicated runner.
 */
const VUS_CEILING = Number(process.env.K6_VUS_CEILING || '8');
const requestedVus = Number(argument('vus', process.env.VUS || '2'));
const rampSeconds = argument('ramp', process.env.RAMP || '10s');
const holdSeconds = argument('duration', process.env.DURATION || '15s');
if (!Number.isFinite(requestedVus) || requestedVus < 1) {
  fail(`--vus must be a positive number; got ${argument('vus', process.env.VUS || '2')}`);
}
if (requestedVus > VUS_CEILING && !flag('allow-heavy')) {
  fail(
    `VUS=${requestedVus} exceeds this runner's ceiling of ${VUS_CEILING}. ` +
      'Re-run with --allow-heavy when the target is a dedicated runner, not a workstation. ' +
      'A load run on the machine you are using will measure that machine.',
  );
}

function fail(message, code = 2) {
  console.error(`\nREFUSING: ${message}`);
  process.exit(code);
}

function resolveK6() {
  const explicit = process.env.K6_BIN;
  if (explicit) {
    if (!fs.existsSync(explicit)) fail(`K6_BIN points at ${explicit}, which does not exist.`);
    return explicit;
  }
  const probe = spawnSync('k6', ['version'], { encoding: 'utf8' });
  if (probe.status === 0) return 'k6';
  fail(`k6 is not on PATH. Install it (https://grafana.com/docs/k6/latest/set-up/install-k6/) or set K6_BIN.`);
  return '';
}

let target;
try {
  target = new URL(baseUrl);
} catch {
  fail(`--base-url is not a URL: ${baseUrl}`);
}

for (const { re, why } of FORBIDDEN) {
  if (re.test(target.hostname)) fail(`${target.hostname} — ${why}. A stress run creates real rows.`);
}
if (!allowNonProduction) {
  fail(
    `--base-url ${target.host} is not refused by name, but this run still creates real rows on a server you did not declare disposable. ` +
      'Re-run with --allow-nonproduction once you have confirmed the target is a local or dedicated staging copy.',
  );
}

const k6 = resolveK6();
if (!fs.existsSync(scriptPath)) fail(`scenario file missing: ${scriptPath}`);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 't360-k6-'));
const summaryPath = path.join(scratch, 'k6-summary.json');

console.log(`k6 ${scenario} scenario`);
console.log(`  target   ${target.origin}${target.pathname}`);
console.log(`  script   ${path.relative(ROOT, scriptPath)}`);
console.log(`  artifact ${path.relative(ROOT, outputPath)}`);
console.log(`  profile   ${requestedVus} VU · ramp ${rampSeconds} · hold ${holdSeconds}${flag('allow-heavy') ? ' · HEAVY OVERRIDE' : ''}`);
if (requestedVus >= 6) console.log('\n  This is a heavy profile. It belongs on a dedicated runner; on a workstation it measures the workstation.');

/** Pre-flight against the live server, so a failed run explains WHY instead of blaming k6. */
const health = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`).catch(() => null);
let runtime = { sourceFingerprint: null, databaseTarget: null };
if (health && health.ok) {
  const body = await health.json().catch(() => ({}));
  runtime = { sourceFingerprint: body?.release?.sourceFingerprint ?? null, databaseTarget: body?.release?.databaseTarget ?? null };
  if (expectedSource && runtime.sourceFingerprint !== expectedSource) {
    fail(`runtime source fingerprint ${runtime.sourceFingerprint} does not match the expected ${expectedSource}. A stress number for different source proves nothing.`);
  }
  if (expectedDbHost || expectedDbName) {
    const actual = runtime.databaseTarget;
    if (!actual || actual.profile !== 'postgresql') fail('runtime database target is not PostgreSQL, so a load number would not describe the production engine.');
    if (actual.hostHash !== expectedDbHost || actual.databaseHash !== expectedDbName) fail('runtime database target does not match the expected database.');
  }
} else {
  fail(`health check failed against ${baseUrl}. A stress run against an unreachable API measures the network, not the application.`);
}

// The scenarios read short names (`TOKEN`, `SKU`) because that is what a k6 script naturally uses, but the
// workflow supplies prefixed ones (`K6_STRESS_TOKEN`, `K6_STRESS_SKU`). Nothing bridged the two, so every
// automatic run reached k6 with no token at all and reported a fast, meaningless number: the first four
// executions of this harness all died here or just before it. `K6_STRESS_TOKEN` is also the better name to
// configure, because a bare `TOKEN` in a CI environment is one unrelated step away from being set.
//
// Both spellings are accepted so a local run and a CI run behave the same. Every name is spelled out
// rather than built with a template, so the contract test can grep the exact string the workflow
// supplies — a workflow value nothing reads is the defect that stopped four runs.
const credential = (short, prefixed) => process.env[prefixed] || process.env[short];
const token = credential('TOKEN', 'K6_STRESS_TOKEN');
const sku = credential('SKU', 'K6_STRESS_SKU');
const customerId = credential('CUSTOMER_ID', 'K6_STRESS_CUSTOMER_ID');
const warehouseId = credential('WAREHOUSE_ID', 'K6_STRESS_WAREHOUSE_ID');

if (!token) {
  console.error(
    'No load-test credential reached k6. Set K6_STRESS_TOKEN (or TOKEN for a local run).\n' +
      'An unauthenticated run is refused at the auth guard before the query runs, which measures the\n' +
      'guard rather than the application.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  BASE_URL: baseUrl,
  K6_SUMMARY_PATH: summaryPath,
  VUS: String(requestedVus),
  RAMP: rampSeconds,
  DURATION: holdSeconds,
  ...(token ? { TOKEN: token } : {}),
  ...(scenario === 'write' ? { ALLOW_WRITES: flag('allow-writes') ? 'yes' : 'no' } : {}),
  // R6 performs bounded writes (materialize, import) and they are idempotent per iteration, so it is
  // not a write opt-in scenario. It is called out here because the distinction matters when reading a
  // run: this one touches data, the read one does not.
  ...(sku ? { SKU: sku } : {}),
  ...(customerId ? { CUSTOMER_ID: customerId } : {}),
  ...(warehouseId ? { WAREHOUSE_ID: warehouseId } : {}),
};

console.log('\n--- k6 ---');
const run = spawnSync(k6, ['run', '--quiet', scriptPath], {
  cwd: scratch,
  env: { ...env, BASE_URL: baseUrl },
  encoding: 'utf8',
  stdio: ['ignore', 'inherit', 'inherit'],
});
const exitCode = run.status ?? 1;

const raw = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '';
const summary = raw ? JSON.parse(raw) : { metrics: {} };
const metrics = summary.metrics ?? {};

const thresholdFailures = Object.entries(metrics).flatMap(([name, metric]) =>
  Object.entries(metric.thresholds ?? {})
    .filter(([, held]) => held === false)
    .map(([expression]) => `${name}: ${expression}`),
);
const iterationCount = metrics.iterations?.values?.count ?? 0;
const requestCount = metrics.http_reqs?.values?.count ?? 0;
if (requestCount === 0) {
  console.error('\nThe k6 summary carried no request counts. The run happened but its result cannot be measured, so it is not evidence of anything.');
}

const evidence = {
  scenario,
  profile: {
    vus: requestedVus,
    rampSeconds,
    durationSeconds: holdSeconds,
    heavyOverride: flag('allow-heavy'),
  },
  status: exitCode === 0 && thresholdFailures.length === 0 && requestCount > 0 ? 'PASS' : 'FAIL',
  exitCode,
  target: target.origin,
  script: path.relative(ROOT, scriptPath),
  runtimeSourceFingerprint: runtime.sourceFingerprint,
  runtimeDatabaseTarget: runtime.databaseTarget,
  requests: requestCount,
  iterations: iterationCount,
  httpReqFailedRate: metrics.http_req_failed?.values?.rate ?? null,
  durationAvgMs: metrics.http_req_duration?.values?.avg ?? null,
  durationP95Ms: metrics.http_req_duration?.values?.['p(95)'] ?? null,
  durationP99Ms: metrics.http_req_duration?.values?.['p(99)'] ?? null,
  checksRate: metrics.checks?.values?.rate ?? null,
  thresholdFailures,
  finishedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

if (!keepArtifacts) fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

console.log(`\n=== ${evidence.status} ===`);
console.log(`  requests        ${evidence.requests}`);
console.log(`  iterations      ${evidence.iterations}`);
console.log(`  p95 / p99       ${Math.round(evidence.durationP95Ms ?? 0)}ms / ${Math.round(evidence.durationP99Ms ?? 0)}ms`);
console.log(`  error rate      ${evidence.httpReqFailedRate === null ? 'n/a' : (evidence.httpReqFailedRate * 100).toFixed(2) + '%'}`);
console.log(`  checks passed   ${evidence.checksRate === null ? 'n/a' : (evidence.checksRate * 100).toFixed(2) + '%'}`);
if (thresholdFailures.length) {
  console.log('\nBroken thresholds:');
  for (const failure of thresholdFailures) console.log(`  FAIL ${failure}`);
}
console.log(`\nEvidence: ${path.relative(ROOT, outputPath)}`);

if (evidence.status !== 'PASS') {
  console.log('\nDo NOT cite this run as a performance result. Either a threshold broke, or the run exercised nothing at all.');
}
process.exit(evidence.status === 'PASS' ? 0 : 1);
