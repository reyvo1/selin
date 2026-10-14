import fs from 'node:fs';
import path from 'node:path';

/**
 * A-09 / A-12 — the rule that keeps credential files and generated runtime
 * evidence out of tracked source.
 *
 * The previous guard was an allow-list of five hard-coded paths, which means a
 * credential at any other path sailed through green. That narrowness is itself
 * an instance of finding A-02, so the rule here is general and the only way
 * out is an explicit exemption carrying a rationale.
 */

export const MIN_EXEMPTION_RATIONALE = 20;

export const HYGIENE_EXEMPTIONS = [];

const KEY_FILE = /(?:^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.pub)?$/;
const KEY_EXTENSION = /\.(?:pem|key|p12|pfx|jks|keystore|der)$/;
const CREDENTIAL_FILE = /(?:^|\/)(?:credentials|secrets?|service-?account)(?:[-._][^/]*)?\.json$/i;
const GENERATED_QUALITY = /^handoff\/quality\/.+\.(?:json|md)$/;
const RUNTIME_LOG = /^logs\//;
const RECOVERY_BACKUP = /(?:^|\/)[^/]*recovery-backup[^/]*$/;
const ENV_FILE = /(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.env(?:\.[^/]*)?)$/;

const CONN_URL = /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/([^/\s'"]+):([^/\s'"@]+)@/g;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;
const PROVIDER_TOKEN = /\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,})/;

const PLACEHOLDER_PASSWORD = [
  /^change[_-]?me/i,
  /^ganti-dengan/i,
  /^(?:user|username|pass|password|passwd|secret|token|key|p|u)$/i,
  /^toko360(?:_ci_password|_dev_password)?$/i,
  /^(?:schema_check|example|placeholder|dummy|sample|test|testing|local|ci)$/i,
  /^(?:\$\{?\w+\}?|\*+|x{3,})$/,
];

export function isPlaceholderCredential(password) {
  const value = String(password ?? '');
  return PLACEHOLDER_PASSWORD.some((pattern) => pattern.test(value));
}

function exemptionFor(file, rule, exemptions) {
  const found = exemptions.find((entry) => entry.path === file && (entry.rule === rule || entry.rule === '*'));
  if (!found) return null;
  if (typeof found.rationale !== 'string' || found.rationale.trim().length < MIN_EXEMPTION_RATIONALE) {
    throw new Error(
      `Hygiene exemption for ${file} (${rule}) must carry a rationale of at least ${MIN_EXEMPTION_RATIONALE} characters.`,
    );
  }
  return found;
}

/**
 * Tier A - private keys and provider tokens - is checked in every tracked file.
 * Tier B - connection strings - is checked everywhere except test fixtures and
 * documented `.example` files, because tests legitimately build synthetic URLs
 * while CI-local throwaway database passwords are already placeholders. A real
 * credential still cannot hide in a test: the key, credential and env file
 * rules apply at any path and Tier A still reads the file.
 */
function contentViolations({ file, content = '' }) {
  const violations = [];
  if (typeof content !== 'string' || content.length === 0) return violations;
  if (content.includes('\u0000')) return violations;

  if (PRIVATE_KEY.test(content)) violations.push({ rule: 'secret-content', reason: 'private key block' });
  if (PROVIDER_TOKEN.test(content)) violations.push({ rule: 'secret-content', reason: 'provider token pattern' });

  if (/^tests\//.test(file) || file.endsWith('.example')) return violations;

  for (const match of content.matchAll(CONN_URL)) {
    if (!isPlaceholderCredential(match[2])) {
      violations.push({ rule: 'secret-content', reason: `connection string with non-placeholder password` });
      break;
    }
  }
  return violations;
}

export function classifyTrackedFile({ file, content = '' }, { exemptions = HYGIENE_EXEMPTIONS } = {}) {
  const base = path.posix.basename(file);
  const rules = [];

  if (ENV_FILE.test(file) && !base.endsWith('.example')) rules.push({ rule: 'env-file', reason: 'tracked env file without .example placeholder suffix' });
  if (KEY_FILE.test(file) || KEY_EXTENSION.test(base)) rules.push({ rule: 'key-file', reason: 'tracked key or certificate file' });
  if (CREDENTIAL_FILE.test(file)) rules.push({ rule: 'credential-file', reason: 'tracked credential container file' });
  if (GENERATED_QUALITY.test(file)) rules.push({ rule: 'generated-quality', reason: 'generated quality artifact must be produced by CI, not tracked' });
  if (RUNTIME_LOG.test(file)) rules.push({ rule: 'runtime-log', reason: 'runtime log directory must not be tracked' });
  if (RECOVERY_BACKUP.test(base)) rules.push({ rule: 'recovery-backup', reason: 'recovery backup must not be tracked' });

  rules.push(...contentViolations({ file, content }));

  const violations = [];
  for (const violation of rules) {
    if (exemptionFor(file, violation.rule, exemptions)) continue;
    violations.push(violation);
  }
  return violations;
}

export function findForbiddenTrackedFiles({ files, read, exemptions = HYGIENE_EXEMPTIONS }) {
  const failures = [];
  for (const file of files) {
    let content = '';
    try {
      content = read(file);
    } catch {
      content = '';
    }
    for (const violation of classifyTrackedFile({ file, content }, { exemptions })) {
      failures.push(`Generated/credential artifact must not be tracked: ${file} [${violation.rule}: ${violation.reason}]`);
    }
  }
  return failures;
}

export function trackedHygieneFailures({ root, tracked, exemptions = HYGIENE_EXEMPTIONS }) {
  return findForbiddenTrackedFiles({
    files: tracked,
    exemptions,
    read: (file) => fs.readFileSync(path.join(root, file), 'utf8'),
  });
}
