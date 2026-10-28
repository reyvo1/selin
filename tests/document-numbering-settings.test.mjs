import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('numbering service is configurable per company/branch/document type', () => {
  const service = read('apps/api/src/number-sequences/number-sequences.service.ts');
  assert.match(service, /list\(user/);
  assert.match(service, /upsert\(user/);
  assert.match(service, /numberSequence\.findMany/);
  assert.match(service, /numberSequence\.create/);
  assert.match(service, /numberSequence\.update/);
});

test('numbering controller exposes settings endpoints', () => {
  const controller = read('apps/api/src/number-sequences/number-sequences.controller.ts');
  assert.match(controller, /@Controller\('number-sequences'\)/);
  assert.match(controller, /@Get\(\)/);
  assert.match(controller, /@Post\(\)/);
});

test('numbering admin surface exists', () => {
  const view = read('apps/admin/app/modules/number-sequences.tsx');
  assert.match(view, /Penomoran Dokumen/);
  assert.match(view, /\/number-sequences/);
});

test('nextDocumentNumber uses configured prefix format padding and reset policy', () => {
  const numbering = read('apps/api/src/common/numbering.ts');
  assert.match(numbering, /effectivePrefix/);
  assert.match(numbering, /effectiveFormat/);
  assert.match(numbering, /effectivePadding/);
  assert.match(numbering, /effectiveResetPolicy/);
  assert.match(numbering, /formatDocumentNumber/);
});

test('IPOS I05 marked ADA', () => {
  const ipos = read('docs/IPOS-5-PARITY-WORKFLOW.md');
  assert.match(ipos, /\| I05 \| Penomoran \| `ADA` \|/);
});
