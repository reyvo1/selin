#!/usr/bin/env node
// Menyusun baseline migration PostgreSQL yang deterministik dari schema Prisma.
// Output: database/postgresql/releases/0001_baseline.sql (schema + post-migration SQL).
// Mode --check dipakai CI/test untuk mendeteksi baseline usang (drift).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = 'apps/api/prisma/schema.postgresql.prisma';
const postMigrationDir = join(root, 'database/postgresql/post-migration');
const outputPath = join(root, 'database/postgresql/releases/0001_baseline.sql');
const checkMode = process.argv.includes('--check');

function resolvePrismaCli() {
  const candidates = [
    join(root, 'node_modules/prisma/build/index.js'),
    join(root, 'apps/api/node_modules/prisma/build/index.js'),
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('Prisma CLI tidak ditemukan. Jalankan npm install terlebih dahulu.');
}

function renderBaseline() {
  const schemaSql = execFileSync(
    process.execPath,
    [resolvePrismaCli(), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const postFiles = existsSync(postMigrationDir)
    ? readdirSync(postMigrationDir).filter((name) => name.endsWith('.sql')).sort()
    : [];
  const postSql = postFiles.map((name) =>
    `-- Post-migration: ${name}\n${readFileSync(join(postMigrationDir, name), 'utf8').trim()}`,
  ).join('\n\n');
  const parts = [
    '-- Toko360 PostgreSQL baseline (expand-only, versioned).',
    '-- GENERATED FILE - jangan edit manual.',
    '-- Regenerate: npm run db:baseline:postgres',
    `-- Source schema: ${schemaPath}`,
    `-- Post-migration files: ${postFiles.length}`,
    '',
    schemaSql.trim(),
    '',
    postSql,
  ];
  return `${parts.join('\n').trimEnd()}\n`;
}

const baseline = renderBaseline();
if (checkMode) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== baseline) {
    console.error('Baseline PostgreSQL usang. Jalankan: npm run db:baseline:postgres');
    process.exit(1);
  }
  console.log('Baseline PostgreSQL sinkron dengan schema + post-migration SQL.');
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, baseline);
  console.log(`Baseline ditulis: ${relative(root, outputPath)} (${Buffer.byteLength(baseline)} bytes).`);
}
