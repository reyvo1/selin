import fs from 'node:fs';
import path from 'node:path';

export const REPOSITORY_FILE = 'REPOSITORY_FILE';
export const CI_GENERATED_ARTIFACT = 'CI_GENERATED_ARTIFACT';
export const GITHUB_LOG_ARCHIVE = 'GITHUB_LOG_ARCHIVE';
export const SOURCE_COMMIT = 'SOURCE_COMMIT';
export const UNRESOLVED = 'UNRESOLVED';
export const EMPTY = 'EMPTY';

export const EVIDENCE_KINDS = [REPOSITORY_FILE, CI_GENERATED_ARTIFACT, GITHUB_LOG_ARCHIVE, SOURCE_COMMIT];

const GITHUB_LOG_PATTERN = /^logs_[0-9]+\.zip$/;
const SOURCE_COMMIT_PATTERN = /^source-commit:[0-9a-f]{7,40}$/i;
const SCRIPT_EXTENSIONS = ['.mjs', '.js', '.sh'];

export function collectScriptSource(root) {
  const scriptsDir = path.join(root, 'scripts');
  if (!fs.existsSync(scriptsDir)) return '';
  const chunks = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SCRIPT_EXTENSIONS.includes(path.extname(entry.name))) chunks.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(scriptsDir);
  return chunks.join('\n');
}

export function classifyEvidence(entry, { root, declaredArtifacts = new Set(), scriptSource = '' }) {
  if (typeof entry !== 'string' || !entry.trim()) return { kind: EMPTY, entry };
  if (GITHUB_LOG_PATTERN.test(entry)) return { kind: GITHUB_LOG_ARCHIVE, entry };
  if (SOURCE_COMMIT_PATTERN.test(entry)) return { kind: SOURCE_COMMIT, entry };
  if (fs.existsSync(path.join(root, entry))) return { kind: REPOSITORY_FILE, entry };
  if (declaredArtifacts.has(entry)) {
    if (scriptSource.includes(entry)) return { kind: CI_GENERATED_ARTIFACT, entry };
    return { kind: UNRESOLVED, entry, reason: 'CI artifact tersebut tidak diproduksi oleh script mana pun di scripts/' };
  }
  return { kind: UNRESOLVED, entry, reason: 'bukan berkas repository yang ada, bukan CI artifact terdaftar, dan bukan pola log/commit yang dikenal' };
}

export function loadDeclaredArtifacts(matrix) {
  return new Set(Array.isArray(matrix.runtimeEvidenceArtifacts) ? matrix.runtimeEvidenceArtifacts : []);
}

function hasConcreteAnchor(kinds) {
  if (kinds.includes(REPOSITORY_FILE) || kinds.includes(CI_GENERATED_ARTIFACT)) return true;
  return kinds.includes(GITHUB_LOG_ARCHIVE) && kinds.includes(SOURCE_COMMIT);
}

export function validateEvidenceArray(item, { root, declaredArtifacts, scriptSource }) {
  const failures = [];
  const entries = Array.isArray(item.evidence) ? item.evidence : [];
  if (!entries.length) {
    failures.push(`${item.id} cannot be ${item.status} without explicit evidence.`);
    return failures;
  }
  const kinds = [];
  for (const entry of entries) {
    const classified = classifyEvidence(entry, { root, declaredArtifacts, scriptSource });
    kinds.push(classified.kind);
    if (classified.kind === UNRESOLVED || classified.kind === EMPTY) {
      failures.push(`${item.id} evidence tidak dapat diverifikasi (${classified.kind}): ${JSON.stringify(entry)}${classified.reason ? ` — ${classified.reason}` : ''}. Evidence wajib berupa path repository yang ada, CI artifact terdaftar yang benar-benar diproduksi script, logs_<run>.zip, atau source-commit:<sha>. Prosa bebas bukan evidence.`);
    }
  }
  if (!hasConcreteAnchor(kinds)) {
    failures.push(`${item.id} evidence harus menautkan minimal satu concrete anchor: path repository, CI artifact terdaftar, atau pasangan logs_<run>.zip + source-commit:<sha>.`);
  }
  if (item.status === 'HUMAN_ACCEPTED' && !entries.some((entry) => typeof entry === 'string' && /human|operator|stage-20/i.test(entry))) {
    failures.push(`${item.id} HUMAN_ACCEPTED requires explicit human/operator evidence.`);
  }
  return failures;
}

export function validateRegistry({ root, matrix, scriptSource }) {
  const failures = [];
  const registry = matrix.runtimeEvidenceArtifacts;
  if (!Array.isArray(registry) || registry.length === 0) {
    failures.push('config/product-completeness.json must declare a non-empty runtimeEvidenceArtifacts registry so CI-generated evidence is nameable without being tracked.');
    return failures;
  }
  for (const artifact of registry) {
    if (typeof artifact !== 'string' || !artifact.trim()) {
      failures.push('runtimeEvidenceArtifacts must contain only non-empty strings.');
      continue;
    }
    if (fs.existsSync(path.join(root, artifact))) {
      failures.push(`runtimeEvidenceArtifacts entry exists in the repository and must not be tracked: ${artifact}`);
      continue;
    }
    if (!scriptSource.includes(artifact)) {
      failures.push(`runtimeEvidenceArtifacts entry is not produced by any script under scripts/: ${artifact}`);
    }
  }
  return failures;
}
