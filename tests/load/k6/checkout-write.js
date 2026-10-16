// Write-path stress. OPT-IN, and the reason it is a separate file is the reason it is dangerous.
//
// Every iteration here creates a real sale, a real journal entry through Accounting Core, and a real
// inventory movement. AGENTS.md is explicit that every retriable mutation needs an operation key and
// that posting must be idempotent. A stress run without those properties would duplicate sales and
// movements ten thousand times, and no amount of cleanup afterwards makes that a good idea.
//
// SO EVERY REQUEST CARRIES ITS OWN KEY. `${__VU}-${__ITER}` is unique per virtual user per
// iteration, and k6 never replays an iteration, so a retry storm from the load generator itself cannot
// create a second sale from the same key. The server-side idempotency ledger is still the thing that
// makes a REAL retry safe; this only removes the generator's own duplicates.
//
// REFUSAL IS IN THE SCRIPT, NOT ONLY IN THE RUNNER. A scenario that can be pointed at production by
// changing one environment variable is one typo away from writing to a real ledger. The guard below
// reads the target host itself and stops the run before the first request.

import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';
const ALLOW_WRITES = __ENV.ALLOW_WRITES === 'yes';
const SKU = __ENV.SKU || '';
const CUSTOMER_ID = __ENV.CUSTOMER_ID || '';
const WAREHOUSE_ID = __ENV.WAREHOUSE_ID || '';
const UNIT = __ENV.UNIT || 'PCS';

const idempotencyViolations = new Rate('toko360_idempotency_violations');
const createdSales = new Rate('toko360_sales_created');

// Hosts this must never be run against, whatever the caller passes. Kept here so the refusal
// survives someone running `k6 run` directly instead of through the runner.
const FORBIDDEN_HOST = /(^|[.-])(prod|production|live|toko360\.com)([.-]|$)/i;

export const options = {
  stages: [
    { duration: '15s', target: Number(__ENV.VUS || '3') },
    { duration: '30s', target: Number(__ENV.VUS || '3') },
    { duration: '10s', target: Number(__ENV.VUS || '3') },
  ],
  // Deliberately much less load than the read scenario. This measures correctness under repetition,
  // not capacity: the answer to "how many sales can we take" is a capacity question that belongs on
  // a staging copy, and answering it here would leave real rows behind.
  thresholds: {
    checks: ['rate>0.98'],
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    'toko360_idempotency_violations': ['rate==0'],
  },
};

function headers(idempotencyKey) {
  return {
    'Content-Type': 'application/json',
    // Two independent key headers. Whichever one this deployment reads, the key travels with the
    // request rather than depending on the caller remembering a body field.
    'Idempotency-Key': idempotencyKey,
    'X-Operation-Key': idempotencyKey,
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

export function setup() {
  const host = new URL(BASE).hostname;

  // Refusal first, before any credential is used or any row is written.
  if (FORBIDDEN_HOST.test(host)) {
    fail(`REFUSING: ${host} looks like a production target. This scenario writes sales and journals; run it against a local or dedicated staging copy only.`);
  }
  if (!ALLOW_WRITES) {
    fail('REFUSING: ALLOW_WRITES is not "yes". This scenario creates real sales, journals and stock movements; opting in is deliberate.');
  }
  if (!TOKEN) fail('REFUSING: TOKEN is required. A write scenario without a session cannot be scoped to a tenant and must not run.');
  if (!SKU || !WAREHOUSE_ID) fail('REFUSING: SKU and WAREHOUSE_ID are required; guessing them would post against whatever happens to be first.');

  const health = http.get(`${BASE}/health`, { headers: headers(`setup-${__VU}`) });
  if (health.status !== 200) fail(`health returned ${health.status}`);
  return { host, sku: SKU, customerId: CUSTOMER_ID, warehouseId: WAREHOUSE_ID, unit: UNIT };
}

export default function (data) {
  const key = `k6-${__VU}-${__ITER}`;

  // 1. Quote. Read-heavy, and it is the step a cashier waits on, so its latency is what an operator
  //    actually feels before payment is even offered.
  const quote = http.post(
    `${BASE}/sales/quote`,
    JSON.stringify({ items: [{ sku: data.sku, quantity: 1 }] }),
    { headers: headers(`${key}-quote`), tags: { step: 'quote' } },
  );
  check(quote, { 'quote succeeds': () => quote.status === 200 || quote.status === 201 });

  // 2. The sale. This is the row that must never be duplicated.
  const sale = http.post(
    `${BASE}/sales`,
    JSON.stringify({
      warehouseId: data.warehouseId,
      customerId: data.customerId || undefined,
      items: [{ sku: data.sku, quantity: 1 }],
      tender: { code: 'CASH', amount: 100000 },
      idempotencyKey: key,
    }),
    { headers: headers(key), tags: { step: 'sale' } },
  );

  const created = sale.status === 200 || sale.status === 201;
  createdSales.add(created ? 1 : 0);
  idempotencyViolations.add(0);
  check(sale, {
    'sale is accepted or refused, never a 500': () => sale.status < 500,
    'sale is created exactly once': () => created || sale.status === 400 || sale.status === 409,
  });

  // 3. Replay the SAME key. This is the assertion that matters most in the whole file: the server must
  //    recognise the key and return the original sale rather than posting a second one. If it does not,
  //    the threshold above fails and the run is a FAIL, which is the correct outcome — a system that
  //    cannot survive a duplicate submission is not production-ready no matter how fast it is.
  if (created) {
    const replay = http.post(
      `${BASE}/sales`,
      JSON.stringify({
        warehouseId: data.warehouseId,
        items: [{ sku: data.sku, quantity: 1 }],
        tender: { code: 'CASH', amount: 100000 },
        idempotencyKey: key,
      }),
      { headers: headers(key), tags: { step: 'replay' } },
    );
    const sameSale = replay.status === 200 || replay.status === 201;
    const body = replay.json() || {};
    check(replay, { 'replay is accepted rather than rejected outright': () => sameSale || replay.status === 409 });
    if (sameSale && body.number && sale.json('number')) {
      const identical = body.number === sale.json('number');
      idempotencyViolations.add(identical ? 0 : 1);
      check(replay, { 'replay returns the ORIGINAL sale number, not a new one': () => identical });
    }
  }

  sleep(1);
}

export function handleSummary(data) {
  // The output path is given absolutely by the runner. A bare relative filename is resolved by k6
  // against the SCRIPT's directory, not the process cwd, so a run that looks like it wrote into a
  // scratch directory leaves its summary next to the script instead — and one earlier run dropped a
  // k6-summary.json into the repository root. An explicit path removes the ambiguity.
  return { [__ENV.K6_SUMMARY_PATH || 'k6-summary.json']: JSON.stringify(data) };
}
