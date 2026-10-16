// Foto kategori/subkategori: pola yang sama dengan foto produk.
//
// Kategori tidak punya kolom gambar sama sekali, sehingga anggapan umum "setiap
// kategori pasti ada gambarnya" tidak bisa dipenuhi. Perbaikannya expand-only:
// kolom nullable `imageUrl` di 3 dialek schema (tanpa migrasi destruktif),
// DTO + create/update + endpoint upload `POST /master-data/categories/:id/image`
// (scope idempotency 'category-image', audit UPLOAD_CATEGORY_IMAGE, root file
// terpisah), dan picker + pratinjau di form kategori admin.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const schemas = [
  'apps/api/prisma/schema.prisma',
  'apps/api/prisma/schema.sqlite.prisma',
  'apps/api/prisma/schema.postgresql.prisma',
];
for (const schema of schemas) {
  test(`Category.imageUrl nullable ada di ${schema.split('/').pop()}`, () => {
    const content = read(schema);
    const model = content.split('model Category {')[1].split('\n}')[0];
    assert.match(model, /imageUrl\s+String\?/);
  });
}

const dto = read('apps/api/src/master-data/dto/master-data.dto.ts');
const service = read('apps/api/src/master-data/master-data.service.ts');
const controller = read('apps/api/src/master-data/master-data.controller.ts');
const main = read('apps/api/src/main.ts');
const admin = read('apps/admin/app/modules/master-data.tsx');

test('DTO kategori menerima imageUrl http(s)', () => {
  assert.match(dto, /@IsHttpImageUrl\(\) imageUrl\?: string/);
});

test('create dan update kategori menyimpan imageUrl', () => {
  assert.match(service, /imageUrl: dto\.imageUrl\?\.trim\(\) \|\| null/);
  assert.match(service, /if \(dto\.imageUrl !== undefined\) data\.imageUrl = dto\.imageUrl\?\.trim\(\) \|\| null/);
});

test('route upload kategori dijaga master_data.manage dan idempotent', () => {
  assert.match(controller, /@Post\('categories\/:id\/image'\)/);
  assert.match(controller, /uploadCategoryImage/);
  assert.match(controller, /FileInterceptor\('file',\s*\{\s*limits:\s*\{\s*fileSize:\s*5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(service, /scope: 'category-image'/);
  assert.match(service, /this\.audit\(tx, user, 'UPLOAD_CATEGORY_IMAGE'/);
  assert.match(service, /buildPublicImageUrl\(hostInfo\.protocol, hostInfo\.host, storageKey, '\/media\/category-images\/'\)/);
});

test('file kategori tersaji statis di prefix sendiri', () => {
  assert.match(main, /prefix: '\/media\/category-images\/'/);
});

test('admin punya picker foto kategori dengan pratinjau', () => {
  assert.match(admin, /alt="Pratinjau foto kategori"/);
  assert.match(admin, /\/master-data\/categories\/\$\{editingCategoryId\}\/image/);
  assert.match(admin, /Simpan kategori dulu, lalu upload fotonya/);
});
