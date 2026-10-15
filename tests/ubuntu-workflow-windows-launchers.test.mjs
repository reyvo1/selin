import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A-13. docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md section 8 says the
 * Ubuntu operator path is npm/Node/Bash and that obsolete Windows launchers are
 * not part of the canonical source flow. Since the 957-file audit the finding has
 * sat at PARTIAL while the launchers it describes were already gone - a status
 * that lags the evidence, which is the A-14 class of defect. Prose is not a gate,
 * so this test converts the claim into one that can fail.
 *
 * The rule is about operator-facing clutter only: a file that is itself a Windows
 * launcher, or an npm script that requires a Windows shell. A `win32` branch
 * inside a Node script is correctly platform-guarded cross-platform developer
 * support and is a no-op on Ubuntu - it is not clutter, and deleting it would be
 * a regression, not a cleanup.
 */
const LAUNCHER_EXTENSIONS = ['.bat', '.cmd', '.ps1', '.vbs'];
const WINDOWS_SHELL_PATTERN = /\b(?:cmd\.exe|powershell(?:\.exe)?|notepad(?:\.exe)?)\b|\.(?:bat|cmd)\b/i;

function trackedFiles() {
  return fs
    .readdirSync(path.join(root, 'scripts'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `scripts/${entry.name}`);
}

function listGitTracked() {
  // git is authoritative for "tracked"; fall back to a filesystem walk so the
  // test still runs in an environment without git.
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split('\n');
  return walk(root, []).map((file) => path.relative(root, file).replaceAll(path.sep, '/'));
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function scanLauncherFiles(files) {
  const offenders = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (LAUNCHER_EXTENSIONS.includes(ext)) offenders.push(file);
  }
  return offenders;
}

function scanNpmScripts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  return Object.entries(scripts)
    .filter(([, command]) => WINDOWS_SHELL_PATTERN.test(String(command)))
    .map(([name, command]) => `${name}: ${command}`);
}

test('the Ubuntu workflow carries zero tracked Windows-first launchers', () => {
  const files = listGitTracked();
  const offenders = scanLauncherFiles(files.length ? files : trackedFiles());
  assert.deepEqual(offenders, [], `tracked Windows launcher files must not exist:\n${offenders.join('\n')}`);
});

test('no package.json script requires a Windows shell', () => {
  const offenders = scanNpmScripts();
  assert.deepEqual(offenders, [], `npm scripts must not invoke a Windows shell:\n${offenders.join('\n')}`);
});

test('a synthetic Windows launcher is caught by the same rule', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't360-launcher-'));
  const synthetic = path.join(tmp, 'start.cmd');
  fs.writeFileSync(synthetic, '@echo off\r\nnpm run dev\r\n');
  assert.deepEqual(
    scanLauncherFiles([synthetic]).map((file) => path.basename(file)),
    ['start.cmd'],
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a synthetic windows-only npm script is caught by the same rule', () => {
  const pkg = { scripts: { 'dev:win': 'cmd.exe /c npm run dev', 'dev': 'node --watch' } };
  const offenders = Object.entries(pkg.scripts)
    .filter(([, command]) => WINDOWS_SHELL_PATTERN.test(String(command)))
    .map(([name]) => name);
  assert.deepEqual(offenders, ['dev:win']);
});

test('platform-guarded win32 support in Node scripts is not operator clutter', () => {
  // The rule must not fire on the legitimately guarded developer helpers.
  const guarded = [
    'scripts/agent-doctor.mjs',
    'scripts/generate-chat-context.mjs',
    'scripts/start-work.mjs',
    'scripts/create-chat-checkpoint.mjs',
    'scripts/run-postgres-dr-drill.mjs',
  ];
  for (const file of guarded) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(
      source,
      /process\.platform\s*===\s*['"]win32['"]|isWindows/,
      `${file} must stay platform-guarded; deleting it would be a regression, not a cleanup`,
    );
  }
});

test('the docs still state the Ubuntu-first operator path', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md'), 'utf8');
  assert.match(doc, /Ubuntu-first operations/);
  assert.match(doc, /npm\/Node\/Bash/);
  assert.match(doc, /without CMD\/PowerShell/);
});
