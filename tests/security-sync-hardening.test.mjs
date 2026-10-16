// Dua celah yang ditemukan audit kode penuh, bukan audit dokumen:
//
// 1. GET /products publik (tanpa login) mengembalikan full row Prisma termasuk
//    costPrice produk dan tiap variant — HPP seluruh katalog bisa dibaca siapa
//    saja. Respons anonim hanya membuang companyId.
// 2. branch-sync tidak pernah pulih sendiri: pullEvents hanya melayani
//    PENDING/PUBLISHING, recordFailure memindahkan event ke FAILED, dan tidak
//    ada worker yang mengembalikannya ke PENDING — data macet diam-diam setelah
//    internet pulih sampai operator menekan requeue manual.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const productsService = read('apps/api/src/products/products.service.ts');
const workerIndex = read('apps/worker/src/index.ts');
const branchSyncService = read('apps/api/src/branch-sync/branch-sync.service.ts');

test('respons produk anonim membuang costPrice produk dan variant', () => {
  assert.match(productsService, /costPrice: _costPrice/);
  assert.match(productsService, /costPrice: _variantCost/);
  assert.ok(!productsService.includes('salePrice: _'), 'harga jual tidak boleh ikut dibuang');
});

test('respons terautentikasi tidak berubah', () => {
  assert.match(productsService, /if \(user\) return \{ \.\.\.page, items: pricedItems \}/);
});

test('worker memanggil requeue sync di setiap tick', () => {
  assert.match(workerIndex, /await requeueDueSyncEvents\(\);/);
  assert.match(workerIndex, /async function requeueDueSyncEvents\(\): Promise<void>/);
});

test('hanya FAILED jatuh tempo di bawah ambang yang kembali PENDING', () => {
  assert.match(workerIndex, /status: 'FAILED', nextRetryAt: \{ lte: now \}, attempts: \{ lt: SYNC_DEAD_LETTER_THRESHOLD \}/);
  assert.match(workerIndex, /data: \{ status: 'PENDING', nextRetryAt: null, lastError: null \}/);
  assert.match(workerIndex, /action: 'SYNC_EVENT_REQUEUED_AUTO'/);
});

test('ambang worker sama dengan ambang dead-letter API', () => {
  const apiThreshold = branchSyncService.match(/DEAD_LETTER_THRESHOLD\s*=\s*(\d+)/);
  const workerThreshold = workerIndex.match(/SYNC_DEAD_LETTER_THRESHOLD\s*=\s*(\d+)/);
  assert.ok(apiThreshold && workerThreshold, 'kedua ambang harus terbaca');
  assert.equal(workerThreshold[1], apiThreshold[1], 'ambang worker dan API tidak boleh beda');
});
