// Upload foto produk: operator bisa memakai file di perangkatnya sendiri,
// bukan hanya URL yang diketik manual.
//
// Akar masalahnya: `imageUrl` hanya bisa diisi lewat kolom URL, sehingga foto
// yang adanya di laptop/HP tidak pernah bisa masuk katalog. `POST
// /products/:id/image` menutupnya: file divalidasi isi (bukan klaim MIME),
// disimpan di disk server cabang dengan nama acak, dan `imageUrl` diisi URL
// http(s) yang lolos validator IsHttpImageUrl. Test ini mengunci tiga lapis:
// fungsi murni (magic byte, batas 5 MiB, bentuk URL), kontrak source (route,
// permission, idempotency, audit, static serving, CORS), dan UI admin (picker,
// pratinjau, gerbang permission).
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const util = await import('./helpers/import-ts.mjs')
  .then((m) => m.load('apps/api/src/products/product-image.util.ts', { platform: 'node' }));

const jpeg = (size) => {
  const buffer = Buffer.alloc(size);
  buffer[0] = 0xff; buffer[1] = 0xd8; buffer[2] = 0xff;
  return buffer;
};
const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const webp = () => Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii'), Buffer.alloc(4)]);

test('magic byte yang cocok lolos per tipe', () => {
  assert.equal(util.validateImageBytes(jpeg(100), 'image/jpeg').extension, '.jpg');
  assert.equal(util.validateImageBytes(png(), 'image/png').extension, '.png');
  assert.equal(util.validateImageBytes(webp(), 'image/webp').extension, '.webp');
});

test('isi yang tidak cocok dengan klaim MIME ditolak', () => {
  assert.throws(() => util.validateImageBytes(png(), 'image/jpeg'), /tidak sesuai/);
  assert.throws(() => util.validateImageBytes(Buffer.alloc(100), 'image/jpeg'), /tidak sesuai/);
});

test('tipe di luar allowlist dan file raksasa ditolak', () => {
  assert.throws(() => util.validateImageBytes(Buffer.from('%PDF-12345'), 'application/pdf'), /JPEG, PNG/);
  assert.throws(() => util.validateImageBytes(jpeg(util.MAX_IMAGE_BYTES + 1), 'image/jpeg'), /5 MiB/);
  assert.throws(() => util.validateImageBytes(Buffer.alloc(0), 'image/png'), /kosong/);
});

test('storage key tenant-scoped dan nama file acak', () => {
  const first = util.buildImageStorageKey('comp-1', 'prod-1', '.jpg');
  const second = util.buildImageStorageKey('comp-1', 'prod-1', '.jpg');
  assert.ok(first.startsWith('comp-1/prod-1/') && first.endsWith('.jpg'));
  assert.notEqual(first, second, 'nama file harus acak per upload');
  assert.equal(util.buildImageStorageKey('../../etc', 'p', '.png').split('/')[0], '.._.._etc');
});

test('URL publik memakai host request dan lolos bentuk http', () => {
  const url = util.buildPublicImageUrl('http', '192.168.1.10:4000', 'c/p/f.jpg');
  assert.equal(url, 'http://192.168.1.10:4000/media/product-images/c/p/f.jpg');
  assert.throws(() => util.buildPublicImageUrl('http', 'a b', 'c/p/f.jpg'), /Host/);
});

const controller = read('apps/api/src/products/products.controller.ts');
const service = read('apps/api/src/products/products.service.ts');
const main = read('apps/api/src/main.ts');
const admin = read('apps/admin/app/modules/master-data.tsx');

test('route upload dijaga permission product.update dan batas 5 MiB', () => {
  assert.match(controller, /@Post\(':id\/image'\)/);
  assert.match(controller, /@Permissions\('product\.update'\)/);
  assert.match(controller, /FileInterceptor\('file',\s*\{\s*limits:\s*\{\s*fileSize:\s*5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(controller, /@Headers\('idempotency-key'\)/i);
});

test('service idempotent, tenant-scoped, beraudit, dan kompensasi file gagal', () => {
  assert.match(service, /beginIdempotent\(tx,\s*\{\s*companyId:\s*scope\.companyId,\s*scope:\s*'product-image'/);
  assert.match(service, /completeIdempotent\(tx,/);
  assert.match(service, /findFirst\(\{\s*where:\s*\{\s*id,\s*companyId:\s*scope\.companyId\s*\}/);
  assert.match(service, /action:\s*'UPLOAD_PRODUCT_IMAGE'/);
  assert.match(service, /await unlink\(absolute\)/);
  assert.match(service, /flag:\s*'wx'/);
});

test('file tersaji statis dan header idempotency lolos preflight', () => {
  assert.match(main, /useStaticAssets\(.*product-images.*prefix:\s*'\/media\/product-images\/'/s);
  assert.match(main, /'Idempotency-Key'/);
});

test('admin punya picker file, pratinjau, dan gerbang permission', () => {
  assert.match(admin, /type="file"\s+accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(admin, /alt="Pratinjau foto produk"/);
  assert.match(admin, /\/products\/\$\{editingProductId\}\/image/);
  assert.match(admin, /'Idempotency-Key':crypto\.randomUUID\(\)/);
  assert.match(admin, /Simpan produk dulu, lalu upload fotonya/);
});
