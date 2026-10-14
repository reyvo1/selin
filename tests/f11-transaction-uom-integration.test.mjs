import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const schemas = ['schema.prisma','schema.sqlite.prisma','schema.postgresql.prisma'].map((name) => read(`apps/api/prisma/${name}`));
const poDto = read('apps/api/src/purchase-orders/dto/create-purchase-order.dto.ts');
const prDto = read('apps/api/src/purchase-orders/dto/purchase-request.dto.ts');
const po = read('apps/api/src/purchase-orders/purchase-orders.service.ts');
const pr = read('apps/api/src/purchase-orders/purchase-requests.service.ts');
const gr = read('apps/api/src/goods-receipts/goods-receipts.service.ts');
const ops = read('apps/api/src/operations-control/operations-control.service.ts');
const purchaseUom = read('apps/api/src/common/purchase-uom.ts');
const saleDto = read('apps/api/src/sales/dto/create-sale.dto.ts');
const sales = read('apps/api/src/sales/sales.service.ts');
const transactionUom = read('apps/api/src/common/transaction-uom.ts');
const products = read('apps/api/src/products/products.service.ts');
const pos = read('apps/pos/app/page.tsx');
const admin = read('apps/admin/app/page.tsx');
const sqliteMigration = read('database/migrations/T360-20260923-f11-transaction-uom/sqlite-expand.sql');
const pgMigration = read('database/migrations/T360-20260923-f11-transaction-uom/postgresql-expand.sql');
const prSqliteMigration = read('database/migrations/T360-20261012-f11-purchase-uom-request/sqlite-expand.sql');
const prPgMigration = read('database/migrations/T360-20261012-f11-purchase-uom-request/postgresql-expand.sql');

test('F11 transaction snapshots keep purchase receipt and sale UOM traceability in all schemas', () => {
  for (const schema of schemas) {
    assert.match(schema, /model PurchaseOrderItem[\s\S]*productUnitId\s+String\?[\s\S]*unitQuantity\s+Int\?[\s\S]*quantityFactor\s+Int\s+@default\(1\)[\s\S]*purchaseUnitCost\s+Decimal\?/);
    assert.match(schema, /model GoodsReceiptItem[\s\S]*productUnitId\s+String\?[\s\S]*unitQuantity\s+Int\?[\s\S]*damagedUnitQuantity\s+Int\?[\s\S]*quantityFactor\s+Int\s+@default\(1\)/);
    assert.match(schema, /model SaleItem[\s\S]*variantId\s+String\?[\s\S]*productUnitId\s+String\?[\s\S]*unitQuantity\s+Int\?[\s\S]*quantityFactor\s+Int\s+@default\(1\)/);
  }
  for (const migration of [sqliteMigration, pgMigration]) {
    assert.match(migration, /PurchaseOrderItem/); assert.match(migration, /GoodsReceiptItem/); assert.match(migration, /SaleItem/); assert.match(migration, /productUnitId/); assert.match(migration, /quantityFactor/);
  }
});

test('F11 purchase resolves ProductUnit authoritatively and stores inventory quantity in base units', () => {
  assert.match(poDto, /productUnitId\?: string/);
  // ProductUnit lookup and conversion arithmetic live in ONE shared resolver, so PurchaseRequest,
  // PurchaseOrder and GoodsReceipt cannot drift apart on factor safety or master-reference checks.
  // tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs executes that resolver against a real
  // database; these assertions pin that the three documents actually use it instead of re-deriving.
  assert.match(purchaseUom, /client\.productUnit\.findFirst/);
  assert.match(purchaseUom, /barcode\.productUnitId/);
  assert.match(purchaseUom, /baseQuantity = unitQuantity \* quantityFactor/);
  assert.match(purchaseUom, /purchaseUnitCost\.div\(quantityFactor\)/);
  assert.match(po, /resolvePurchaseUnitLine/);
  assert.match(pr, /resolvePurchaseUnitLine/);
  assert.match(pr, /orderedQty: purchaseUnitQuantity\(item\)/);
  assert.match(po, /toPurchaseBaseQuantity\(item\.orderedQty, uom\.quantityFactor\)/);
  assert.match(po, /toPurchaseBaseUnitCost\(purchaseUnitCost, uom\.quantityFactor\)/);
  assert.match(gr, /quantityReceived = toPurchaseBaseQuantity\(unitQuantity, factor\)/);
  assert.match(gr, /damaged = damagedUnitQuantity > 0 \? toPurchaseBaseQuantity\(damagedUnitQuantity, factor\) : 0/);
  assert.match(gr, /accepted = quantityReceived - damaged/);
  assert.match(gr, /receivedQty: \{ increment: item\.acceptedQty \}/);
  assert.match(gr, /quantity: item\.acceptedQty/);
});

test('F11 purchase request stores the same immutable UOM snapshot as PO and GRN', () => {
  for (const schema of schemas) {
    assert.match(schema, /model PurchaseRequestItem[\s\S]*unitQuantity\s+Int\?[\s\S]*quantityFactor\s+Int\s+@default\(1\)[\s\S]*unitCode\s+String\?[\s\S]*productUnitId\s+String\?[\s\S]*variantId\s+String\?[\s\S]*sourceBarcode\s+String\?/);
  }
  for (const migration of [prSqliteMigration, prPgMigration]) {
    assert.match(migration, /PurchaseRequestItem/);
    assert.match(migration, /productUnitId/);
    assert.match(migration, /quantityFactor/);
    assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i, 'expand-only: migration tidak boleh menghapus kolom');
  }
  assert.match(prDto, /productUnitId\?: string/);
  assert.match(prDto, /barcodeCode\?: string/);
  assert.match(pr, /estimatedUnitCost\.mul\(purchaseUnitQuantity\(item\)\)/, 'approval amount memakai harga per unit pembelian');
  assert.match(ops, /scannedQty: nextScanned/, 'scan inspeksi menambah factor barcode, bukan 1');
  assert.match(ops, /scanQuantity/);
});

test('F11 Sales and POS select ProductUnit directly while barcode remains only a shortcut', () => {
  assert.match(saleDto, /productUnitId\?: string/);
  assert.match(sales, /resolveSellingUnitLine/);
  assert.match(transactionUom, /input\.productUnitId/);
  assert.match(transactionUom, /client\.productUnit\.findFirst/);
  assert.match(transactionUom, /barcode\.productUnitId/);
  assert.match(sales, /productUnitId: item\.conversion\.productUnitId/);
  assert.match(products, /units: \{ where: \{ isActive: true \}/);
  assert.match(pos, /productUnitId\?: string/);
  assert.match(pos, /product\.units/);
  assert.match(pos, /productUnitId: item\.productUnitId/);
  assert.match(pos, /unit\.unitCode/);
});

test('F11 Admin purchase and receipt operator flow exposes UOM quantity instead of pretending every quantity is base unit', () => {
  assert.match(admin, /productUnitId/);
  assert.match(admin, /Unit pembelian/);
  assert.match(admin, /Jumlah unit beli/);
  assert.match(admin, /Harga per unit beli/);
  assert.match(admin, /item\.quantityFactor/);
  assert.match(admin, /item\.unitCode \?\? item\.product\.unit/);
});
