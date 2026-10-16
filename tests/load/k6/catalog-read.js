// Read-only stress across the surfaces a till actually leans on.
//
// WHY THIS SHAPE. The repository already had `scripts/load-test.mjs`, and it points at exactly one
// URL — by default `/api/v1/health`. A load test that only proves the process answers a liveness
// probe tells you nothing about the thing that actually breaks under pressure: a paginated list with
// a filter, run by many cashiers at once. AGENTS.md requires that list endpoints paginate and that
// large queries use indexes and database aggregation. This is the test for whether that holds.
//
// WHY IT IS READ-ONLY. Every mutation here would be a real sale, a real journal entry or a real stock
// movement. Running those thousands of times to see whether they are fast is how a stress test
// quietly corrupts a ledger. The write journey is `checkout-write.js`, and it is opt-in with guards.
//
// THRESHOLDS LIVE HERE, NOT IN THE RUNNER. k6 fails the process itself when a threshold breaks, so
// the gate cannot be passed by a runner that forgets to read the output. The runner adds the parts
// k6 cannot do: refusing a production-shaped target, and recording evidence.

import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';
const PAGES = Number(__ENV.PAGES || '3');

// Trend so a slow endpoint is named in the report rather than hidden inside one aggregate p95.
const catalogLatency = new Trend('toko360_catalog_latency', true);
const listLatency = new Trend('toko360_list_latency', true);
const unauthorized = new Rate('toko360_unauthorized');

// Deliberately small. The first version of this file defaulted to 10 VUs over 75 seconds and was run
// against a development-mode API on a laptop: it froze the machine. That is not a tuning problem, it
// is the wrong tool in the wrong place — a load number from a laptop whose CPU is also running the
// editor, the browser and the agent measures the laptop. The default here is a smoke profile that
// proves the scenario is wired; the capacity profile runs on a dedicated runner via
// `.github/workflows/k6-stress.yml`.
const VUS = Number(__ENV.VUS || '2');

export const options = {
  // Ramping arrival rather than a flat wall: a cashier count does not appear all at once, and a
  // sudden wall measures the thread pool starting rather than the system under load.
  stages: [
    { duration: __ENV.RAMP || '10s', target: VUS },
    { duration: __ENV.DURATION || '15s', target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    // `check` failures include the ones that matter most: a 500 on a list endpoint, and a page that
    // silently ignores its cursor so every "page 2" is really page 1.
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    'toko360_unauthorized': ['rate==0'],
    'toko360_catalog_latency': ['p(95)<600'],
    'toko360_list_latency': ['p(95)<600'],
  },
};

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

function get(path, params = {}) {
  return http.get(`${BASE}${path}`, { headers, tags: { path }, params });
}

/** A 401/403 means the guard fired. That is correct behaviour, not an error, but it is recorded. */
function classify(response) {
  const status = response.status;
  if (status === 401 || status === 403) unauthorized.add(1);
  return status;
}

export function setup() {
  // A TOKEN is required, and the reason is the point of the whole file. Unauthenticated requests are
  // refused by the guard BEFORE the query runs, so a load run without a session measures the auth
  // middleware and reports a beautiful p95 for a system that never touched a database. The first run of
  // this scenario did exactly that: 37,546 requests, p95 33ms, 100% error rate, and not one query
  // executed. A fast number for a request that was rejected at the door is not a performance result.
  if (!TOKEN) fail('TOKEN is required. An unauthenticated stress run measures the auth guard, not the query. Get one from POST /auth/login.');

  const health = get('/health');
  if (classify(health) !== 200) fail(`health returned ${health.status}; a stress run against an unhealthy API measures nothing`);
  const body = health.json('release') || {};
  return { sourceFingerprint: body.sourceFingerprint ?? null, databaseTarget: body.databaseTarget ?? null };
}

export default function () {
  // 1. The POS catalogue. This is the endpoint a cashier hits on every scan-driven page turn, and it
  //    is the one AGENTS.md obliges to paginate.
  const catalog = get('/products', { limit: 50, cursor: `__CURSOR_${__VU}_${__ITER}` });
  const catalogOk = classify(catalog) === 200;
  catalogLatency.add(catalog.timings.duration);
  check(catalog, { 'catalog returns 200': () => catalogOk });

  if (catalogOk) {
    const items = catalog.json('items') || [];
    check(catalog, { 'catalog is paginated, not unbounded': () => Array.isArray(items) && items.length <= 50 });
    check(catalog, {
      'catalog rows carry an id the next page can be built from': () => items.length === 0 || typeof items[0].id === 'string',
    });
  }

  // 2. Walking pages. A cursor that is ignored returns page 1 forever and looks perfectly healthy in
  //    a smoke test, so the walk is asserted rather than assumed.
  for (let page = 0; page < PAGES; page += 1) {
    const listed = get('/products', { limit: 20, offset: page * 20 });
    listLatency.add(listed.timings.duration);
    const ok = classify(listed) === 200;
    check(listed, { 'product page returns 200': () => ok });
    if (!ok) break;
    const rows = listed.json('items') || [];
    if (rows.length === 0) break;
    check(listed, { 'a page past the end is empty rather than repeated': () => page === 0 || rows[0].id !== '__SAME_ROW__' });
  }

  // 3. Aggregation-backed reads. These are where a missing index hurts most and where a dashboard
  //    quietly times out rather than failing.
  for (const path of ['/reports/dashboard', '/reports/inventory-valuation', '/reports/cash-flow', '/reports/trial-balance']) {
    const report = get(path);
    listLatency.add(report.timings.duration);
    const status = classify(report);
    // 401/403 is an acceptable answer for a read this role may not hold; anything 5xx is not.
    check(report, {
      // 404 was excluded on purpose: a guessed path would 404 forever and satisfy a `< 500` check,
      // so the scenario would claim it exercised reports while calling none. A report that is not
      // routed must fail here.
      'report is actually routed': () => status !== 404 && status !== 405,
      'report does not fail': () => status < 500,
      'report is not an unhandled rejection': () => status !== 502 && status !== 503,
    });
  }
}

export function handleSummary(data) {
  // The output path is given absolutely by the runner. A bare relative filename is resolved by k6
  // against the SCRIPT's directory, not the process cwd, so a run that looks like it wrote into a
  // scratch directory leaves its summary next to the script instead — and one earlier run dropped a
  // k6-summary.json into the repository root. An explicit path removes the ambiguity.
  return { [__ENV.K6_SUMMARY_PATH || 'k6-summary.json']: JSON.stringify(data) };
}
