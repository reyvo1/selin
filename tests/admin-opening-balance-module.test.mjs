import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/admin/app/modules/opening-balance.tsx', import.meta.url), 'utf8');

test('opening balance admin module exposes the opening and year-end API surface', () => {
  const endpoints = [
    '/accounting/opening-balance/batches',
    '/accounting/opening-balance/batches/${selectedId}',
    '/accounting/opening-balance/batches/${id}/rows',
    '/accounting/opening-balance/batches/preview',
    '/accounting/opening-balance/batches/${selectedId}/revalidate',
    '/accounting/opening-balance/batches/${selectedId}/submit',
    '/accounting/opening-balance/batches/${selectedId}/approve',
    '/accounting/opening-balance/batches/${selectedId}/cancel',
    '/accounting/opening-balance/batches/${selectedId}/post',
    '/accounting/opening-balance/batches/${selectedId}/reverse',
    '/accounting/opening-balance/ledger/settle',
    '/accounting/opening-balance/cutover',
    '/accounting/opening-balance/year-end',
    '/accounting/opening-balance/year-end/reverse',
  ];
  for (const endpoint of endpoints) assert.match(source, new RegExp(endpoint.replace(/\$\{[^}]+\}/g, '\\$\\{[^}]+\\}').replace(/\//g, '\\/')));
});

test('opening balance admin module gates actions with accounting.opening permissions', () => {
  for (const permission of ['accounting.opening.view', 'accounting.opening.import', 'accounting.opening.approve', 'accounting.opening.post', 'accounting.opening.reverse']) {
    assert.match(source, new RegExp(permission.replace(/\./g, '\\.')));
  }
  assert.match(source, /export default function OpeningBalanceView/);
});
