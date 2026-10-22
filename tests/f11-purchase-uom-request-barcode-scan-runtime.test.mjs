// Apakah purchasing benar-benar bisa membeli per karton, atau hanya bisa "produk x 24 @ 1.000"?
//
// Fakta yang tidak dijawab repo ini: sisi JUAL (POS) punya bukti runtime (tests/uom-multilevel-sale-runtime.test.mjs),
// sisi BELI (PR/PO/GRN) tidak punya apa pun. Test purchase UOM yang ada di repo ini semuanya
// SOURCE-REGEX: mereka membaca string di purchase-orders.service.ts, tidak pernah menjalankan
// service-nya. Kalau factor-nya hilang, ditimes 1, atau barang rusak salah hitung, semua test itu
// tetap hijau.
//
// Yang diuji di sini dijalankan sungguhan terhadap SQLite nyata, lewat service ASLI:
//
//   1. Purchase request bisa memilih unit PEMBELIAN dan menyimpan snapshot-nya. Sebelumnya
//      PurchaseRequestItem tidak punya kolom UOM sama sekali, jadi convert() selalu membuat PO
//      dengan quantityFactor 1: "3 karton" menjadi "3 BATANG".
//   2. convert() meneruskan snapshot itu ke PO: unitQuantity tetap purchase unit, orderedQty base.
//   3. Barcode pembelian me-resolve unit-nya dari ProductUnit, bukan menebak.
//   4. GRN: 2 karton datang, 1 rusak -> 48 base received / 24 damaged / 24 accepted.
//   5. Confirm: stok +24 base, satu InventoryMovement append-only, jurnal debit-kredit balance
//      dengan basis = purchaseUnitCost x karton yang diterima bersih.
//   6. Snapshot immutable: mengubah quantityFactor ProductUnit SETELAH PO dibuat tidak mengubah
//      arti penerimaan maupun posting yang sudah memakai factor lama.
//   7. Scan barcode karton pada inspeksi menambah factor-nya, bukan 1, karena expectedQty itu base.
//
// Jebakan yang sama seperti tests/uom-multilevel-sale-runtime.test.mjs, sengaja dihindari:
// snapshot dibaca dari DB (bukan dari response API), harga diturunkan dari angka master (bukan
// diketik hardcode), dan setiap konversi dihitung dari factor yang benar-benar tersimpan di baris
// dokumen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { load } from './helpers/import-ts.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't360-f11-po-'));
const DB = path.join(TMP, 'purchase-uom.db');
const prismaFml = path.join(ROOT, 'apps/api/prisma/schema.sqlite.prisma');

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', prismaFml],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB}` }, stdio: 'pipe' });

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });
const opts = { platform: 'node', external: ['@prisma/client'] };
const nestOpts = {
  platform: 'node',
  external: ['@prisma/client', '@nestjs/microservices', '@nestjs/websockets', '@nestjs/websockets/socket-module'],
};

const { PurchaseOrdersService } = await load('apps/api/src/purchase-orders/purchase-orders.service.ts', opts);
const { PurchaseRequestsService } = await load('apps/api/src/purchase-orders/purchase-requests.service.ts', nestOpts);
const { GoodsReceiptsService } = await load('apps/api/src/goods-receipts/goods-receipts.service.ts', nestOpts);
const { OperationsControlService } = await load('apps/api/src/operations-control/operations-control.service.ts', nestOpts);
const { AccountingCoreService } = await load('apps/api/src/accounting-core/accounting-core.service.ts', opts);
const { InventoryCostingService } = await load('apps/api/src/inventory/costing.service.ts', opts);

const operations = new OperationsControlService(prisma);
const accounting = new AccountingCoreService(prisma);
const purchaseOrders = new PurchaseOrdersService(prisma);
const goodsReceipts = new GoodsReceiptsService(prisma, accounting, operations, new InventoryCostingService());

// PurchaseRequestsService only needs the approval-request surface from PlatformService, so the
// real service is not loaded here: approval policy resolution is not what this test is about.
const platformStub = {
  createApprovalRequest: async ({ entityType, entityId, amount, context }) => prisma.approvalRequest.create({
    data: { companyId: COMPANY, branchId: BRANCH, entityType, entityId, status: 'PENDING', requesterId: USER.sub, amount, context },
  }),
  decideApproval: async (approvalRequestId, dto) => prisma.approvalRequest.update({
    where: { id: approvalRequestId },
    data: { status: dto.status, decidedAt: new Date() },
  }),
};
const purchaseRequests = new PurchaseRequestsService(prisma, platformStub, purchaseOrders);

const COMPANY = 'acme';
const BRANCH = 'br-1';
const USER = { sub: 'u-1', companyId: COMPANY, branchId: BRANCH, roles: ['ADMIN'], permissions: [] };
const PRODUCT = 'p-minyak';
const CARTON_BARCODE = '8991234500017';

const ACCOUNTS = [
  ['1301', 'Persediaan', 'ASSET'], ['1205', 'PPN Masukan', 'ASSET'], ['2101', 'Hutang Usaha', 'LIABILITY'],
];
const RECEIPT_RULE = {
  code: 'PURCHASE-RECEIPT-CREDIT', eventType: 'PURCHASE_RECEIPT_CREDIT', lines: [
    { accountCodeKey: 'inventory', side: 'DEBIT', amountKey: 'inventory' },
    { accountCodeKey: 'inputTax', side: 'DEBIT', amountKey: 'inputTax', skipIfZero: true },
    { accountCodeKey: 'payable', side: 'CREDIT', amountKey: 'payable' },
  ],
};

// Base unit = BATANG. KARTON isi 24 BATANG. Factor selalu langsung ke base unit, tidak berantai.
const CARTON_FACTOR = 24;
const COST_PER_CARTON = 300000;
const TAX_RATE = '11';

let carton = null;
let taxCode = null;

async function seed() {
  await prisma.company.upsert({ where: { id: COMPANY }, update: {}, create: { id: COMPANY, name: 'Acme', slug: 'acme', timezone: 'Asia/Makassar', currency: 'IDR' } });
  await prisma.user.upsert({ where: { email: 'purchasing@test' }, update: {}, create: { id: USER.sub, name: 'Pembeli', email: 'purchasing@test', passwordHash: 'x', isActive: true } });
  await prisma.branch.upsert({ where: { id: BRANCH }, update: {}, create: { id: BRANCH, companyId: COMPANY, code: 'BR1', name: 'Cabang 1', isActive: true } });
  for (const [code, name, type] of ACCOUNTS) {
    await prisma.account.upsert({ where: { branchId_code: { branchId: BRANCH, code } }, update: { name, type }, create: { branchId: BRANCH, code, name, type } });
  }
  await prisma.warehouse.upsert({ where: { id: 'wh-1' }, update: {}, create: { id: 'wh-1', code: 'W1', name: 'Gudang', branchId: BRANCH, isActive: true, isDefault: true } });
  await prisma.supplier.upsert({ where: { id: 'sup-1' }, update: {}, create: { id: 'sup-1', code: 'SUP1', name: 'Supplier Minyak', companyId: COMPANY, isActive: true } });
  for (const code of ['BATANG', 'KARTON']) {
    await prisma.masterReference.upsert({
      where: { companyId_type_code: { companyId: COMPANY, type: 'UNIT', code } },
      update: { isActive: true },
      create: { companyId: COMPANY, branchId: null, type: 'UNIT', code, name: code, isActive: true },
    });
  }
  await prisma.product.upsert({
    where: { id: PRODUCT },
    update: { unit: 'BATANG', costPrice: 1000, salePrice: 1500 },
    create: { id: PRODUCT, companyId: COMPANY, sku: 'MINYAK-1L', name: 'Minyak 1L', unit: 'BATANG', costPrice: 1000, salePrice: 1500 },
  });
  carton = await prisma.productUnit.upsert({
    where: { productId_scopeKey_unitCode: { productId: PRODUCT, scopeKey: 'BASE', unitCode: 'KARTON' } },
    update: { quantityFactor: CARTON_FACTOR },
    create: { productId: PRODUCT, unitCode: 'KARTON', quantityFactor: CARTON_FACTOR, scopeKey: 'BASE', isDefaultPurchase: true, isActive: true },
  });
  await prisma.productBarcode.upsert({
    where: { code: CARTON_BARCODE },
    update: { quantityFactor: CARTON_FACTOR, productUnitId: carton.id },
    create: { productId: PRODUCT, code: CARTON_BARCODE, unitCode: 'KARTON', quantityFactor: CARTON_FACTOR, productUnitId: carton.id, isPrimary: false },
  });
  taxCode = await prisma.taxCode.upsert({
    where: { companyId_code_version: { companyId: COMPANY, code: 'PPN11', version: 1 } },
    update: {},
    create: {
      companyId: COMPANY, code: 'PPN11', version: 1, name: 'PPN 11%', rate: TAX_RATE,
      scope: 'PURCHASE', inclusive: false, recoverable: true,
      effectiveFrom: new Date('2020-01-01'), status: 'ACTIVE',
    },
  });
  await prisma.accountingPostingRule.upsert({
    where: { companyId_code_version: { companyId: COMPANY, code: RECEIPT_RULE.code, version: 1 } },
    update: {},
    create: { companyId: COMPANY, code: RECEIPT_RULE.code, version: 1, name: RECEIPT_RULE.code, eventType: RECEIPT_RULE.eventType, status: 'ACTIVE', journalLines: RECEIPT_RULE.lines },
  });
}

async function resetInventory() {
  const existing = await prisma.inventory.findFirst({ where: { warehouseId: 'wh-1', productId: PRODUCT } });
  if (existing) await prisma.inventory.update({ where: { id: existing.id }, data: { quantity: 0, available: 0, reserved: 0 } });
  else await prisma.inventory.create({ data: { warehouseId: 'wh-1', productId: PRODUCT, quantity: 0, available: 0, reserved: 0 } });
}

test('purchase request can express a purchase unit and convert keeps the snapshot', async () => {
  await seed();
  const request = await purchaseRequests.create({
    warehouseId: 'wh-1',
    supplierId: 'sup-1',
    items: [{ productId: PRODUCT, productUnitId: carton.id, quantity: 3, estimatedUnitCost: COST_PER_CARTON }],
  }, USER);

  const stored = await prisma.purchaseRequestItem.findFirst({ where: { purchaseRequestId: request.id } });
  assert.ok(stored, 'item purchase request harus tersimpan');
  assert.equal(stored.unitCode, 'KARTON');
  assert.equal(stored.quantityFactor, CARTON_FACTOR);
  assert.equal(stored.unitQuantity, 3, 'permintaan dicatat dalam unit pembelian yang dipilih');
  assert.equal(stored.quantity, 3 * CARTON_FACTOR, 'quantity tetap canonical base quantity');
  assert.equal(stored.productUnitId, carton.id);

  await purchaseRequests.submit(request.id, {}, USER);
  await purchaseRequests.decide(request.id, { status: 'APPROVED' }, USER);
  const order = await purchaseRequests.convert(request.id, {}, USER);

  const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: order.id } });
  assert.equal(poItem.productUnitId, carton.id, 'PR->PO harus meneruskan ProductUnit, bukan jatuh ke factor 1');
  assert.equal(poItem.quantityFactor, CARTON_FACTOR);
  assert.equal(poItem.unitCode, 'KARTON');
  assert.equal(poItem.unitQuantity, 3, 'orderedQty pada input PO adalah jumlah unit pembelian');
  assert.equal(poItem.orderedQty, 3 * CARTON_FACTOR, 'stok selalu dihitung dalam base unit');
  assert.equal(Number(poItem.purchaseUnitCost), COST_PER_CARTON);
  assert.equal(Number(poItem.unitCost), COST_PER_CARTON / CARTON_FACTOR, 'harga base diturunkan dari harga per karton');
  assert.equal(Number(poItem.subtotal), COST_PER_CARTON * 3);

  const approval = await prisma.approvalRequest.findFirst({ where: { entityId: request.id } });
  assert.equal(Number(approval.amount), COST_PER_CARTON * 3, 'nilai approval memakai harga per unit pembelian');
});

test('purchase order accepts a purchase barcode and resolves its unit server-side', async () => {
  const order = await purchaseOrders.create({
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    items: [{ productId: PRODUCT, barcodeCode: CARTON_BARCODE, orderedQty: 2, unitCost: COST_PER_CARTON }],
  }, USER);
  const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: order.id } });
  assert.equal(poItem.productUnitId, carton.id, 'barcode harus resolve ke ProductUnit yang ditunjuknya');
  assert.equal(poItem.quantityFactor, CARTON_FACTOR);
  assert.equal(poItem.orderedQty, 2 * CARTON_FACTOR);
  assert.equal(Number(poItem.subtotal), COST_PER_CARTON * 2, 'subtotal mengikuti harga per karton, bukan per batang');

  await assert.rejects(
    () => purchaseOrders.create({
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      items: [{ productId: PRODUCT, barcodeCode: '8990000000000', orderedQty: 1, unitCost: 1000 }],
    }, USER),
    /tidak valid untuk produk/,
    'barcode milik produk lain tidak boleh dipakai pada produk ini',
  );
});

test('goods receipt converts purchase units, keeps damaged separate, and posts a balanced journal', async () => {
  await resetInventory();
  const order = await purchaseOrders.create({
    idempotencyKey: 'f11-grn-po',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    items: [{ productId: PRODUCT, productUnitId: carton.id, orderedQty: 2, unitCost: COST_PER_CARTON }],
  }, USER);
  const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: order.id } });

  const receipt = await goodsReceipts.create({
    purchaseOrderId: order.id,
    items: [{ purchaseOrderItemId: poItem.id, quantityReceived: 2, quantityDamaged: 1, taxCodeId: taxCode.id }],
  }, USER);

  const item = await prisma.goodsReceiptItem.findFirst({ where: { goodsReceiptId: receipt.id } });
  assert.equal(item.unitCode, 'KARTON');
  assert.equal(item.quantityFactor, CARTON_FACTOR);
  assert.equal(item.unitQuantity, 2);
  assert.equal(item.damagedUnitQuantity, 1);
  assert.equal(item.quantityReceived, 2 * CARTON_FACTOR, 'diterima dihitung dalam base unit');
  assert.equal(item.quantityDamaged, CARTON_FACTOR, 'rusak dihitung dalam base unit');
  assert.equal(item.acceptedQty, CARTON_FACTOR, 'hanya barang yang tidak rusak masuk stok');

  const movementsBefore = await prisma.inventoryMovement.count({ where: { referenceType: 'GoodsReceipt', referenceId: receipt.id } });
  assert.equal(movementsBefore, 0, 'draft penerimaan tidak boleh menyentuh stok');

  await prisma.operationalInspection.update({ where: { id: receipt.inspectionId }, data: { status: 'APPROVED' } });
  await goodsReceipts.confirm(receipt.id, { inspectionId: receipt.inspectionId }, USER);

  const inventory = await prisma.inventory.findFirst({ where: { warehouseId: 'wh-1', productId: PRODUCT } });
  assert.equal(inventory.quantity, CARTON_FACTOR, 'stok bertambah sebesar unit yang diterima bersih');

  const movements = await prisma.inventoryMovement.findMany({ where: { referenceType: 'GoodsReceipt', referenceId: receipt.id } });
  assert.equal(movements.length, 1, 'satu penerimaan = satu movement append-only');
  assert.equal(movements[0].quantity, CARTON_FACTOR);

  const receivedPoItem = await prisma.purchaseOrderItem.findFirst({ where: { id: poItem.id } });
  assert.equal(receivedPoItem.receivedQty, CARTON_FACTOR, 'PO hanya bertambah sebesar unit yang benar-benar diterima bersih');

  const event = await prisma.accountingEvent.findFirst({ where: { sourceType: 'GoodsReceipt', sourceId: receipt.id } });
  assert.ok(event, 'penerimaan harus memposting accounting event');
  assert.equal(event.status, 'POSTED');

  const eventLines = await prisma.accountingEventLine.findMany({ where: { accountingEventId: event.id }, orderBy: { lineNumber: 'asc' } });
  assert.equal(eventLines.length, 1);
  assert.equal(Number(eventLines[0].quantity), CARTON_FACTOR, 'baris jurnal memakai base quantity, bukan jumlah karton');
  assert.equal(Number(eventLines[0].netAmount), COST_PER_CARTON, 'baris jurnal memakai harga per base unit');

  const postings = await prisma.accountingPosting.findMany({ where: { accountingEventId: event.id } });
  assert.ok(postings.length >= 1, 'event harus punya posting');
  const lines = await prisma.journalLine.findMany({ where: { journalEntryId: postings[0].journalEntryId }, include: { account: true }, orderBy: { id: 'asc' } });
  assert.ok(lines.length >= 2, 'jurnal penerimaan harus punya minimal satu baris debit dan satu kredit');

  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit);
    credit += Number(line.credit);
  }
  assert.ok(Math.abs(debit - credit) < 0.01, `jurnal harus balance: debit ${debit} vs kredit ${credit}`);
  assert.ok(debit > 0, 'jurnal tidak boleh nol');

  const netExpected = COST_PER_CARTON;
  const taxExpected = new Prisma.Decimal(netExpected).mul(new Prisma.Decimal(TAX_RATE)).toDecimalPlaces(2).toNumber();
  assert.ok(Math.abs(debit - (netExpected + taxExpected)) < 0.01, `total debit harus net + pajak, bukan ${debit}`);

  const inventoryLine = lines.find((line) => line.account.code === '1301');
  const inputTaxLine = lines.find((line) => line.account.code === '1205');
  assert.equal(Number(inventoryLine.debit), netExpected, 'basis jurnal memakai harga per base unit');
  assert.equal(Number(inputTaxLine.debit), taxExpected, 'pajak dihitung dari base net, bukan dari jumlah karton');
});

test('editing the master factor after the fact cannot rewrite a posted receipt', async () => {
  const snapshot = await prisma.goodsReceiptItem.findFirst({ where: { quantityFactor: CARTON_FACTOR }, orderBy: { id: 'desc' } });
  assert.ok(snapshot, 'baris penerimaan harus menyimpan factor saat transaksi');

  await prisma.productUnit.update({ where: { id: carton.id }, data: { quantityFactor: 99 } });
  const after = await prisma.goodsReceiptItem.findFirst({ where: { id: snapshot.id } });
  assert.equal(after.quantityFactor, CARTON_FACTOR, 'snapshot factor tidak boleh ikut berubah');
  assert.equal(after.quantityReceived, 2 * CARTON_FACTOR);
  assert.equal(after.acceptedQty, CARTON_FACTOR);

  const movement = await prisma.inventoryMovement.findFirst({ where: { referenceType: 'GoodsReceipt' }, orderBy: { id: 'desc' } });
  assert.equal(movement.quantity, CARTON_FACTOR, 'stok yang sudah masuk tidak boleh dihitung ulang dengan factor baru');
  await prisma.productUnit.update({ where: { id: carton.id }, data: { quantityFactor: CARTON_FACTOR } });
});

test('scanning a carton barcode during receiving inspection counts the whole unit', async () => {
  const order = await purchaseOrders.create({
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    items: [{ productId: PRODUCT, productUnitId: carton.id, orderedQty: 2, unitCost: COST_PER_CARTON }],
  }, USER);
  const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: order.id } });
  const receipt = await goodsReceipts.create({
    purchaseOrderId: order.id,
    items: [{ purchaseOrderItemId: poItem.id, quantityReceived: 2 }],
  }, USER);

  const resultItem = await prisma.inspectionResultItem.findFirst({ where: { inspectionId: receipt.inspectionId, productId: PRODUCT } });
  assert.equal(resultItem.expectedQty, 2 * CARTON_FACTOR, 'expectedQty inspeksi adalah base quantity');

  // Satu scan karton = CARTON_FACTOR base unit. Sebelum perbaikan, scannedQty naik 1 sehingga
  // operator harus memindai karton 24 kali hanya untuk menyelesaikan satu baris.
  await operations.addInspectionEvidence(receipt.inspectionId, { evidenceType: 'BARCODE', value: CARTON_BARCODE }, USER);
  const afterOne = await prisma.inspectionResultItem.findFirst({ where: { id: resultItem.id } });
  assert.equal(afterOne.scannedQty, CARTON_FACTOR, 'satu scan barcode karton harus menambah satu unit pembelian penuh');
  assert.ok(afterOne.scannedQty < afterOne.expectedQty, 'satu karton saja belum menutup dua karton yang diharapkan');

  await operations.addInspectionEvidence(receipt.inspectionId, { evidenceType: 'BARCODE', value: CARTON_BARCODE }, USER);
  const afterTwo = await prisma.inspectionResultItem.findFirst({ where: { id: resultItem.id } });
  assert.equal(afterTwo.scannedQty, 2 * CARTON_FACTOR, 'dua karton menutup kuantitas yang diharapkan');

  const evidence = await prisma.inspectionEvidence.findFirst({ where: { inspectionId: receipt.inspectionId } });
  assert.equal(evidence.metadata.scanQuantity, CARTON_FACTOR, 'evidence mencatat berapa base unit yang dipindai');
  assert.equal(evidence.metadata.scanUnitCode, 'KARTON');

  await assert.rejects(
    () => operations.addInspectionEvidence(receipt.inspectionId, { evidenceType: 'BARCODE', value: CARTON_BARCODE }, USER),
    /sudah memenuhi kuantitas/,
    'scan melebihi kuantitas yang diharapkan harus ditolak, bukan membuat scannedQty melewati expectedQty',
  );
});