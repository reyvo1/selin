import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A-14. Prose that says "currently", "current count is", "live counts are",
 * "current figures are" or "now reports" carries a number that is true when
 * written and false at the next commit. Measured on 2026-10-14, seven such
 * lines existed across five governance documents and every one of them was
 * already stale. Counts belong to machines: a document may name the command
 * that regenerates a number, and may record an explicitly dated number, but it
 * may not assert an undated current value.
 */
const LIVE_CLAIM = /(currently holds|currently reports \d|now reports \d|current count is|the current count|live counts? (?:are|is)|current figures are)/i;
const MISSING_GIT_CLAIM = /(this copy has no `?\.git`?|carries no `?\.git`?|no `?\.git`? in the working copy because)/i;

/**
 * A-16. A distribution claim names a status token beside a count, and the two
 * are checkable against the canonical matrix without any list of known-good
 * phrasings. The curated LIVE_CLAIM list above missed the defect recorded on
 * 2026-10-15 — two governance documents carried ten occurrences of a
 * feature-matrix distribution whose counts were off by one, while the matrix
 * held the other values — because that prose never used a curated live-claim
 * word. A rule that is a list of phrasings fails on the first phrasing nobody
 * thought of; this one is derived from the matrix itself and fails on any
 * count that disagrees with it.
 *
 * A bare "N STATUS" is too weak: "27 FOUNDATION, 3 PARTIAL" would read the 3
 * as FOUNDATION's count, and phase designators such as "P2 RUNTIME_VERIFIED"
 * or "P5 IMPLEMENTED_RUNTIME_PENDING" carry no count at all. A distribution
 * claim is the sentence that names two or more status tokens; inside it, every
 * "N STATUS" must match the matrix. Counts are accepted from either the
 * feature matrix or the post-audit findings, because both are authoritative.
 */
const MATRIX_STATUS = ['FOUNDATION', 'PARTIAL', 'IMPLEMENTED_RUNTIME_PENDING', 'RUNTIME_VERIFIED', 'HUMAN_ACCEPTED'];
const STATUS_ALT = MATRIX_STATUS.slice().sort((a, b) => b.length - a.length).join('|');
const COUNT_CLAIM = new RegExp(String.raw`(\d+)\s+(${STATUS_ALT})`, 'g');
const SENTENCE = /[^.!?\n]+/g;
// A phase designator is a phase id bound to a token, not a count —
// `P2 RUNTIME_VERIFIED`, `P5 IMPLEMENTED_RUNTIME_PENDING`. Both shapes occur
// in this corpus, and a phase id is never a count, so these must not be read
// as distribution claims. Without this exemption a line that mentions a phase
// designator *and* a second real token would open the two-token gate and
// report the phase id as a count. The token must still be a real status.
const PHASE_DESIGNATOR = new RegExp(String.raw`\bP[0-9A-Za-z]+[` + '`' + String.raw`\s]*(${STATUS_ALT})`);

export function actualMatrixCounts(rootDir = root) {
  const matrix = JSON.parse(fs.readFileSync(path.join(rootDir, 'config/product-completeness.json'), 'utf8'));
  const tally = (rows) => rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  return { features: tally(matrix.features), findings: tally(matrix.postAuditFindings) };
}

export function matrixDistributionErrors(text, counts = actualMatrixCounts()) {
  const errors = [];
  for (const line of text.split('\n')) {
    // Strip phase designators before scanning, so `P2 RUNTIME_VERIFIED` is
    // never read as a count. This is structural, not a curated exception: a
    // phase id is never a count in any claim the matrix can check.
    const stripped = line.replace(PHASE_DESIGNATOR, '');
    for (const match of stripped.matchAll(COUNT_CLAIM)) {
      const value = Number(match[1]);
      const token = match[2];
      const sentence = SENTENCE[Symbol.matchAll](stripped).find((s) => s.includes(match[0])) ?? stripped;
      const named = MATRIX_STATUS.filter((status) => sentence.includes(status));
      if (named.length < 2) continue;
      const expected = counts.features[token] ?? counts.findings[token];
      if (expected === undefined || value === expected) continue;
      errors.push(`${match[0]} (matrix says ${expected} ${token})`);
    }
  }
  return errors;
}

export function liveClaimLines(text) {
  return text.split('\n').filter((line) => LIVE_CLAIM.test(line) && /\d/.test(line));
}

function scannedFiles() {
  const files = ['STATUS-FINAL.md'];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // `release-evidence` is immutable history; `generated` is derived from
        // the same source each run and cannot drift on its own, so counting it
        // would report the same defect twice under two filenames.
        if (entry.name === 'release-evidence' || entry.name === 'generated') continue;
        walk(full);
      } else if (/\.md$/i.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, 'docs'));
  walk(path.join(root, 'handoff'));
  return files.map((file) => path.relative(root, file).replaceAll(path.sep, '/'));
}

test('no governance document asserts an undated live count', () => {
  const offenders = [];
  for (const file of scannedFiles()) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    liveClaimLines(text).forEach((line) => offenders.push(`${file}: ${line.trim().slice(0, 160)}`));
  }
  assert.deepEqual(offenders, [], `live-count claims must point at a command instead:\n${offenders.join('\n')}`);
});

test('a document may still record a dated count or name the command', () => {
  assert.equal(liveClaimLines('Repository validation: **PASS** (918 files at the time of this wave).').length, 0);
  assert.equal(liveClaimLines('As of 2026-10-14 the run reported 454 routes.').length, 0);
  assert.equal(liveClaimLines('Regenerate with `npm run validate:repo`; it prints the file and model counts.').length, 0);
  assert.equal(liveClaimLines('It now reports 454 routes.').length, 1);
  assert.equal(liveClaimLines('The current count is 1021 files.').length, 1);
  assert.equal(liveClaimLines('The live counts are regenerated by `npm run audit:p5:visual` and are currently 180 models.').length, 1);
});

test('a status distribution claim must match the canonical matrix', () => {
  const offenders = [];
  for (const file of scannedFiles()) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    matrixDistributionErrors(text).forEach((e) => offenders.push(`${file}: ${e}`));
  }
  assert.deepEqual(offenders, [], `distribution claims must match config/product-completeness.json:\n${offenders.join('\n')}`);
});

test('the distribution rule fails closed on a wrong count, not just on wording', () => {
  const counts = actualMatrixCounts();
  const correct = `Canonical matrix: 48 features = ${counts.features.FOUNDATION} FOUNDATION, ${counts.features.PARTIAL} PARTIAL, ${counts.features.IMPLEMENTED_RUNTIME_PENDING} IMPLEMENTED_RUNTIME_PENDING, ${counts.features.RUNTIME_VERIFIED} RUNTIME_VERIFIED.`;
  assert.deepEqual(matrixDistributionErrors(correct, counts), []);

  const wrong = `Canonical matrix: 48 features = ${counts.features.FOUNDATION} FOUNDATION, ${counts.features.PARTIAL} PARTIAL, 16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED.`;
  assert.deepEqual(matrixDistributionErrors(wrong, counts), [
    '16 IMPLEMENTED_RUNTIME_PENDING (matrix says 17 IMPLEMENTED_RUNTIME_PENDING)',
    '2 RUNTIME_VERIFIED (matrix says 1 RUNTIME_VERIFIED)',
  ]);
});

test('the distribution rule ignores phase designators and single-token mentions', () => {
  const counts = actualMatrixCounts();
  // A phase label is not a count: "2" belongs to P2, not to RUNTIME_VERIFIED.
  assert.deepEqual(matrixDistributionErrors('## 2026-09-26 — P2 RUNTIME_VERIFIED / P3 FULL source implementation', counts), []);
  assert.deepEqual(matrixDistributionErrors('`productReady=false`, P5 IMPLEMENTED_RUNTIME_PENDING, Human Stage-20 PENDING', counts), []);
  // A phase designator on a line that also names a second real token must not
  // open the two-token gate. This is the shape that broke the rule on its own
  // authoring: the line was clean, but "5" was read as a count because the
  // sentence happened to contain a second status.
  assert.deepEqual(matrixDistributionErrors('phase designators such as `P2 RUNTIME_VERIFIED` and `P5 IMPLEMENTED_RUNTIME_PENDING` carry no', counts), []);
  // A single status named once is not a distribution.
  assert.deepEqual(matrixDistributionErrors('- A-07 remains `IMPLEMENTED_RUNTIME_PENDING`.'), []);
});

test('no document claims the working copy lacks .git', () => {
  const offenders = [];
  for (const file of scannedFiles()) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    text.split('\n').forEach((line) => {
      if (MISSING_GIT_CLAIM.test(line)) offenders.push(`${file}: ${line.trim().slice(0, 160)}`);
    });
  }
  assert.deepEqual(offenders, [], `the repository does have .git; drop the claim:\n${offenders.join('\n')}`);
  assert.ok(fs.existsSync(path.join(root, '.git')), 'the repository must still have .git');
});

test('legacy status documents still defer to the canonical matrix', () => {
  for (const file of ['docs/PROJECT-STATE.md', 'STATUS-FINAL.md', 'docs/FUNCTIONAL-DEPTH-ROADMAP.md', 'docs/FEATURE-CATALOG.md']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /config\/product-completeness\.json/, file);
  }
});
