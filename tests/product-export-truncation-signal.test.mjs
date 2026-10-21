// Export CSV produk tidak boleh memotong katalog secara diam-diam.
// Service membaca 10.001 baris untuk mendeteksi batas, mengembalikan hanya 10.000,
// dan menyertakan rowLimit/rowCount/truncated agar admin memberi peringatan.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const { load } = await import('./helpers/import-ts.mjs');

const nestOpts = {
  platform: 'node',
  external: ['@prisma/client', '@nestjs/microservices', '@nestjs/websockets', '@nestjs/websockets/socket-module'],
};
const { ProductsService } = await load('apps/api/src/products/products.service.ts', nestOpts);

const user = { sub: 'u1', companyId: 'c1', branchId: 'b1', roles: ['OWNER'] };
const productRow = (index) => ({
  sku: `SKU-${String(index).padStart(6, '0')}`,
  name: index === 0 ? 'Kopi "Spesial", 250g' : `Produk ${index}`,
  barcode: null, unit: 'pcs', costPrice: 1000, salePrice: 1500, retailCeilingPrice: null,
  minStock: 1, brandCode: null, category: null, productType: 'SIMPLE',
  trackBatch: false, trackExpiry: false, trackSerial: false, isActive: true,
});

function serviceWithRows(rows) {
  let captured;
  const prisma = {
    product: {
      findMany: async (args) => {
        captured = args;
        return rows.slice(0, args.take);
      },
    },
  };
  return { service: new ProductsService(prisma), args: () => captured };
}

test('katalog melebihi batas ditandai truncated dan hanya 10.000 baris diekspor', async () => {
  const rows = Array.from({ length: 10002 }, (_, index) => productRow(index));
  const { service, args } = serviceWithRows(rows);
  const result = await service.exportCsv(user);
  assert.equal(args().take, 10001, 'query harus mengambil limit+1 untuk deteksi batas');
  assert.equal(result.rowLimit, 10000);
  assert.equal(result.rowCount, 10000);
  assert.equal(result.truncated, true);
  const lines = result.content.replace(/^\uFEFF/, '').split('\n');
  assert.equal(lines.length, 10001, 'header + 10.000 baris data');
  assert.match(lines[0], /^sku,name,barcode/);
  assert.match(lines[1], /"Kopi ""Spesial"", 250g"/, 'escaping CSV tetap benar');
  assert.ok(!result.content.includes('SKU-010000'), 'baris ke-10.001 tidak boleh ikut');
});

test('katalog di bawah batas diekspor penuh tanpa flag truncated', async () => {
  const { service } = serviceWithRows([productRow(0), productRow(1), productRow(2)]);
  const result = await service.exportCsv(user);
  assert.equal(result.rowCount, 3);
  assert.equal(result.truncated, false);
  assert.equal(result.content.replace(/^\uFEFF/, '').split('\n').length, 4);
});

test('scope tenant tetap wajib untuk export', async () => {
  const { service } = serviceWithRows([]);
  await assert.rejects(() => service.exportCsv({ sub: 'u1', roles: ['OWNER'] }), (error) => error?.response?.code === 'TENANT_CONTEXT_REQUIRED');
});

test('admin menampilkan peringatan saat export terpotong', () => {
  const ui = read('apps/admin/app/modules/product-bulk-labels.tsx');
  assert.match(ui, /truncated\?:boolean/);
  assert.match(ui, /r\.truncated\?/);
  assert.match(ui, /Export dibatasi/);
});

test('endpoint export-csv tetap terdaftar di controller', () => {
  const controller = read('apps/api/src/products/products.controller.ts');
  assert.match(controller, /@Get\('export-csv'\)/);
  assert.match(controller, /exportCsv\(@CurrentUser\(\) user: AuthUser\)/);
});
