import fs from 'node:fs';
import path from 'node:path';

/**
 * A-02 gate inventory.
 *
 * Finding A-02 says an audit or test can report green while the product is
 * incomplete. The first two instances were constants in the R8 probe and a
 * marker-length evidence check; the third is an aggregate predicate where
 * `[].every(Boolean)` is true, so an empty `checks` object passed. Fixing
 * instances one at a time is not a close, so this module enforces the
 * underlying property instead: **every script that emits `status: 'PASS'` must
 * be mechanically bound to something that can fail the build**, and the binding
 * must be proven by parsing the file - never declared in prose.
 *
 * Classification is derived from the files themselves on every run, so there is
 * no stored registry that can silently go stale.
 */

export const GATE_INVENTORY_EXEMPTIONS = [];
export const MIN_EXEMPTION_RATIONALE = 20;
export const PASS_EMITTING_PATTERN = /status:\s*'PASS'/;

const MECHANISM_RULES = {
  'fail-fast-loop': (source) => /Object\.entries\(\s*checks\s*\)/.test(source) && /!\s*passed/.test(source),
  'assert-helper': (source) => (source.match(/\bassert\(/g) || []).length >= 3,
  'inline-throws': (source) => (source.match(/throw\s+/g) || []).length >= 3,
  'assertion-export': (source) =>
    /export\s+(?:function|const)\s+(?:assert|verify|require)[A-Za-z0-9_]*\s*\(/.test(source) && /throw\s+/.test(source),
  'workflow-step': (source, ctx) =>
    ctx.npmScripts.some((name) => ctx.workflows.includes(name)) ||
    ctx.workflows.includes(ctx.file) ||
    ctx.workflows.includes(path.posix.basename(ctx.file)),
  'aggregate-gate': (source, ctx) =>
    [...source.matchAll(/handoff\/quality\/[a-z0-9-]+\.json/g)].some((match) => ctx.summarySource.includes(match[0])),
};

export const MECHANISMS = Object.keys(MECHANISM_RULES);

export function classifyEmitter(source, ctx) {
  return MECHANISMS.filter((name) => MECHANISM_RULES[name](source, ctx));
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export function collectPassEmitters(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.mjs') && PASS_EMITTING_PATTERN.test(readIfExists(full))) {
        found.push(path.relative(root, full).replaceAll(path.sep, '/'));
      }
    }
  };
  if (fs.existsSync(path.join(root, 'scripts'))) walk(path.join(root, 'scripts'));
  return found.sort();
}

export function gateInventory({ root, exemptions = GATE_INVENTORY_EXEMPTIONS }) {
  const workflowsDir = path.join(root, '.github/workflows');
  const workflows = fs.existsSync(workflowsDir)
    ? fs.readdirSync(workflowsDir).map((name) => readIfExists(path.join(workflowsDir, name))).join('\n')
    : '';
  const summarySource = readIfExists(path.join(root, 'scripts/ci-write-full-system-summary.mjs'));
  let npmScripts = [];
  try {
    npmScripts = Object.values(JSON.parse(readIfExists(path.join(root, 'package.json'))).scripts ?? {});
  } catch {
    npmScripts = [];
  }

  const emitters = collectPassEmitters(root).map((file) => {
    const source = readIfExists(path.join(root, file));
    const ctx = { file, workflows, summarySource, npmScripts };
    const exemption = exemptions.find((entry) => entry.path === file && (entry.mechanism === '*' || !entry.mechanism));
    if (exemption && (typeof exemption.rationale !== 'string' || exemption.rationale.trim().length < MIN_EXEMPTION_RATIONALE)) {
      throw new Error(
        `Gate inventory exemption for ${file} must carry a rationale of at least ${MIN_EXEMPTION_RATIONALE} characters.`,
      );
    }
    const mechanisms = classifyEmitter(source, ctx);
    return { file, mechanisms, exempted: Boolean(exemption), rationale: exemption?.rationale ?? '' };
  });

  return { emitters, unclassified: emitters.filter((entry) => entry.mechanisms.length === 0 && !entry.exempted) };
}

export function inventoryFailures({ root, exemptions = GATE_INVENTORY_EXEMPTIONS } = {}) {
  const { emitters, unclassified } = gateInventory({ root, exemptions });
  return unclassified.map(
    (entry) =>
      `${entry.file} emits PASS without a verified binding to a failing gate: add a fail-fast checks loop, an assert helper, three or more inline throws, an assertion export, a workflow step that runs it, or an artifact the aggregate summary gates read.`,
  );
}
