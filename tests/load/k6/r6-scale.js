// Load over the R6 surface: scale summaries, retention, archive runs, marketplace import, and the
// operator assistant.
//
// WHY THIS FILE EXISTS, and it is a gap the operator named rather than one I found. The release chain
// has exactly one load gate — `scripts/load-test.mjs --url /api/v1/health --requests 600
// --concurrency 30` — so the only endpoint proven to survive load anywhere in this repository is the
// liveness probe. R6 is literally named "scale" and its functional probe
// (`scripts/ci-r6-scale-ai-probe.mjs`) calls each route ONCE, in sequence, with no concurrency and no
// latency budget. A probe proves the route is correct; it proves nothing about the route being fast.
//
// These are also the endpoints most likely to be slow in a real way: `daily-summaries` aggregates
// over sales rows, `retention/archive-runs` touches row retention, and `operator-assistant/query` runs
// a query-shaped operation. A missing index in any of them is invisible to every other gate in the
// repository.
//
// READ-ONLY BY CONSTRUCTION. `materialize`, `marketplace-orders/import` and the retention policy write
// are the only mutations, and each is called once per VU with a key derived from the iteration — see
// the idempotency note on each. The volume this file generates is deliberately bounded for that reason:
// it answers "does the aggregation hold up when many cashiers and reports hit it at once", not "what is
// the maximum write throughput", which is a staging-copy question.

import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';
const VUS = Number(__ENV.VUS || '2');

// A separate trend per family. One aggregate p95 across an aggregation endpoint and a warehouse list
// hides whichever one is slow, which is the opposite of what a load test is for.
const aggregationLatency = new Trend('toko360_r6_aggregation_latency', true);
const retentionLatency = new Trend('toko360_r6_retention_latency', true);
const assistantLatency = new Trend('toko360_r6_assistant_latency', true);
const importLatency = new Trend('toko360_r6_import_latency', true);

const errors = new Rate('toko360_r6_errors');
const unauthorized = new Rate('toko360_r6_unauthorized');
const businessRejections = new Rate('toko360_r6_business_rejections');

export const options = {
  stages: [
    { duration: __ENV.RAMP || '10s', target: VUS },
    { duration: __ENV.DURATION || '20s', target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.98'],
    // Business-level refusals (409, 422) are NOT transport failures. Counting them as errors would
    // force the thresholds to be loosened until a wrong answer looked right.
    http_req_failed: ['rate<0.05'],
    'toko360_r6_errors': ['rate<0.01'],
    'toko360_r6_unauthorized': ['rate==0'],
    // Aggregation is the one allowed to be slow. The others are held much tighter because a warehouse
    // list or a retention policy read that takes a second is a defect even at low volume.
    'toko360_r6_aggregation_latency': ['p(95)<2500'],
    'toko360_r6_retention_latency': ['p(95)<1200'],
    'toko360_r6_assistant_latency': ['p(95)<4000'],
    'toko360_r6_import_latency': ['p(95)<3000'],
  },
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
});

/** Classify: 401/403 is the guard firing, 4xx business is a refusal, 5xx is a real failure. */
function score(response) {
  const { status } = response;
  if (status === 401 || status === 403) { unauthorized.add(1); errors.add(0); return 'unauthorized'; }
  if (status >= 500) { errors.add(1); return 'failed'; }
  if (status >= 400) { businessRejections.add(1); errors.add(0); return 'refused'; }
  errors.add(0);
  return 'ok';
}

const today = () => new Date().toISOString().slice(0, 10);

export function setup() {
  if (!TOKEN) fail('TOKEN is required. Without a session every call is refused at the guard before the query, which measures nothing.');
  const health = http.get(`${BASE}/health`);
  if (health.status !== 200) fail(`health returned ${health.status}`);
  const branch = http.get(`${BASE}/auth/branch-context`, { headers: headers() });
  if (branch.status !== 200) fail(`branch-context returned ${branch.status}; the tenant context every scoped call depends on is unavailable`);
  return { businessDate: today() };
}

export default function (data) {
  // Per-iteration key. A VU repeating an iteration must not accumulate work: each materialize and
  // import runs against its own date-and-key so a retry storm from the generator cannot inflate the
  // very tables being measured.
  const key = `k6-r6-${__VU}-${__ITER}`;
  const day = `${data.businessDate}-${key.slice(-6)}`;

  // 1. Aggregation over sales rows. The endpoint most likely to be missing an index.
  const materialized = http.post(
    `${BASE}/analytics/daily-summaries/materialize`,
    JSON.stringify({ businessDate: day, idempotencyKey: key }),
    { headers: headers(), tags: { family: 'aggregation' } },
  );
  aggregationLatency.add(materialized.timings.duration);
  check(materialized, {
    'materialize is accepted or refused, never a 500': () => score(materialized) !== 'failed',
  });

  const summaries = http.get(`${BASE}/analytics/daily-summaries?from=${day}&to=${day}`, { headers: headers(), tags: { family: 'aggregation' } });
  aggregationLatency.add(summaries.timings.duration);
  check(summaries, {
    'daily-summaries is not a server error': () => score(summaries) !== 'failed',
    'daily-summaries answers within the budget': () => summaries.timings.duration < 2500,
  });

  // 2. The other aggregation-backed reads a dashboard actually issues, in the same burst a cashier
  //    closing a shift would produce.
  for (const path of ['/accounting-core/accounts', '/accounting-core/close-controls', '/inventory/warehouses']) {
    const response = http.get(`${BASE}${path}`, { headers: headers(), tags: { family: 'aggregation' } });
    aggregationLatency.add(response.timings.duration);
    check(response, { [`${path} is not a server error`]: () => score(response) !== 'failed' });
  }

  // 3. Retention and archive runs. Row retention is the kind of work that is invisible until a table
  //    is large, which is exactly when nobody is watching.
  const policies = http.get(`${BASE}/retention/policies`, { headers: headers(), tags: { family: 'retention' } });
  retentionLatency.add(policies.timings.duration);
  check(policies, { 'retention policies is not a server error': () => score(policies) !== 'failed' });

  const archiveRuns = http.get(`${BASE}/retention/archive-runs`, { headers: headers(), tags: { family: 'retention' } });
  retentionLatency.add(archiveRuns.timings.duration);
  check(archiveRuns, {
    'archive runs is not a server error': () => score(archiveRuns) !== 'failed',
    'archive runs answers within the retention budget': () => archiveRuns.timings.duration < 1200,
  });

  // 4. The operator assistant. A query-shaped operation over the same tables, so it is the second
  //    place a missing index shows up — and the one an operator waits on interactively.
  const assistant = http.post(
    `${BASE}/operator-assistant/query`,
    JSON.stringify({ question: 'Ringkas kondisi operasional hari ini', idempotencyKey: `${key}-q` }),
    { headers: headers(), tags: { family: 'assistant' } },
  );
  assistantLatency.add(assistant.timings.duration);
  check(assistant, {
    'assistant query is not a server error': () => score(assistant) !== 'failed',
    'assistant answers within its budget': () => assistant.timings.duration < 4000,
  });

  // 5. Marketplace import. Bounded on purpose: one per iteration, with its own idempotency key. This
  //    is here for its read side and its rejection path, not to write a catalogue at load.
  const imported = http.post(
    `${BASE}/marketplace-orders/import`,
    JSON.stringify({ orders: [], idempotencyKey: `${key}-import` }),
    { headers: headers(), tags: { family: 'import' } },
  );
  importLatency.add(imported.timings.duration);
  check(imported, { 'marketplace import is accepted or refused, never a 500': () => score(imported) !== 'failed' });
}

export function handleSummary(data) {
  return { [__ENV.K6_SUMMARY_PATH || 'k6-summary.json']: JSON.stringify(data) };
}
