import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSiblingInconsistencies, FLAG_IDENTITY } from './lib/frontend-endpoint-coverage.mjs';

/**
 * A-17. Measures which backend endpoints no UI app can reach, at endpoint
 * granularity, and refuses to run clean while that set differs from the
 * reviewed baseline.
 *
 * The report is written to handoff/quality/ (gitignored, CI-generated) because
 * it is a measurement of the current source and changes on every commit. The
 * baseline it is compared against lives in
 * config/frontend-endpoint-coverage-baseline.json and is edited by a human
 * only, so the comparison cannot be made to pass by regenerating it - the
 * failure mode where an audit rewrites its own expectation and then reports
 * agreement.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'handoff/quality/frontend-endpoint-coverage-latest.json';
const BASELINE = 'config/frontend-endpoint-coverage-baseline.json';

const measurement = collectSiblingInconsistencies(root);

const controllersByFile = new Map(measurement.controllers.map((c) => [c.file, c]));
const spread = measurement.controllers.reduce((acc, c) => {
  acc[c.uniform] = (acc[c.uniform] ?? 0) + 1;
  return acc;
}, {});

const flagged = measurement.flagged.map((route) => ({
  id: FLAG_IDENTITY(route),
  file: route.file,
  guard: route.roles ? `Roles(${route.roles})` : route.permissions ? `Permissions(${route.permissions})` : 'no endpoint guard',
}));

const report = {
  version: '1.0.0',
  finding: 'audit:A-17',
  generatedAt: new Date().toISOString(),
  summary: {
    controllers: measurement.controllers.length,
    controllerSpread: spread,
    routes: measurement.routes.length,
    distinctPaths: new Set(measurement.routes.map((r) => r.path)).size,
    uiPathTokens: measurement.ui.tokens.size,
    uiSourceLines: measurement.ui.lines.length,
    reachableRoutes: measurement.routes.filter((r) => r.reachable).length,
    flaggedEndpoints: flagged.length,
  },
  controllers: measurement.controllers,
  flagged,
};

const outPath = path.join(root, OUTPUT);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Frontend endpoint coverage written: ${OUTPUT}`);
console.log(`  controllers ${report.summary.controllers} (${Object.entries(spread).map(([k, v]) => `${v} ${k}`).join(', ')})`);
console.log(`  routes ${report.summary.routes} across ${report.summary.distinctPaths} distinct paths`);
console.log(`  flagged endpoints (unreachable with a reachable sibling): ${flagged.length}`);

const baselinePath = path.join(root, BASELINE);
if (!fs.existsSync(baselinePath)) {
  console.error(`BLOCKER: ${BASELINE} is missing; the measurement has no reviewed expectation to compare against.`);
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const expected = new Set((baseline.entries ?? []).map((entry) => entry.id));
const actual = new Set(flagged.map((entry) => entry.id));

const added = [...actual].filter((id) => !expected.has(id)).sort();
const removed = [...expected].filter((id) => !actual.has(id)).sort();
const unjustified = (baseline.entries ?? []).filter((entry) => typeof entry.reason !== 'string' || entry.reason.trim().length < 40);

if (added.length || removed.length || unjustified.length) {
  for (const id of added) console.error(`BLOCKER: ${id} is unreachable from every UI app while a sibling endpoint on ${id.split(' ')[1]} is reachable, and the baseline does not review it.`);
  for (const id of removed) console.error(`BLOCKER: ${id} is reviewed in the baseline but is no longer flagged; remove the entry so the review is not stale.`);
  for (const entry of unjustified) console.error(`BLOCKER: baseline entry ${entry.id} carries no reason of at least 40 characters; an exception without a stated basis is not a review.`);
  process.exit(1);
}
console.log(`  baseline agreed: ${actual.size} entries reviewed in ${BASELINE}`);
