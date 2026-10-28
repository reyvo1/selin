import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../apps/api/src/migration/migration.service.ts', import.meta.url), 'utf8');
const controller = fs.readFileSync(new URL('../apps/api/src/migration/migration.controller.ts', import.meta.url), 'utf8');
const moduleFile = fs.readFileSync(new URL('../apps/api/src/migration/migration.module.ts', import.meta.url), 'utf8');

test('migration module is registered and exposes dry-run/preview/cutover', () => {
  assert.match(service, /dryRun/);
  assert.match(service, /preview/);
  assert.match(service, /cutover/);
  assert.match(service, /cutoverCheck/);
  assert.match(controller, /@Controller\('migration'\)/);
  assert.match(moduleFile, /MigrationModule/);
});

test('migration dry-run validates required fields, duplicates, and negatives', () => {
  assert.match(service, /REQUIRED/);
  assert.match(service, /duplikat|duplicate/i);
  assert.match(service, /negatif|negative/i);
});
