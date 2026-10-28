# Session Handoff — T360-20261021-134120

- Checkpoint baseline: `RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF`
- Work item: `work-items/active/T360-20261021-134120-costing-engine-dan-valuasi-persediaan.json`
- Branch: `feature/T360-20261021-134120-costing-engine-dan-valuasi-persediaan`
- Phase: `IMPLEMENTATION`
- Owner: `architecture`

## Sudah dikerjakan

- Audit source costing/valuasi dan baseline paritas IPOS 5.0.
- ADR disetujui user 21 Oktober 2026:
  `docs/adr/ADR-T360-20261021-134120-COSTING-METHOD.md` (ACCEPTED).
- Schema ketiga profile diperluas: `CostingPolicy`, `InventoryCostState`,
  `InventoryCostEvent`, `InventoryCostLayer`, `InventoryCostConsumption`,
  `CostingRebuildRun`, enum costing, dan `InventoryMovement.occurredAt`.
- `InventoryMovement.occurredAt` nullable **tanpa default** di ketiga schema.
  Default `now()` dihapus karena SQLite menolak `ALTER TABLE ADD COLUMN` dengan
  default non-konstan; migration mengisi balik `occurredAt = createdAt` dan
  writer baru (goods receipt, sales, sale return) mengisi nilainya eksplisit.
- Migration expand-only dibuat:
  `database/migrations/T360-20261021-134120-costing-engine/` (SQLite +
  PostgreSQL + README migration plan), terdaftar di
  `config/expand-migration-order.json`.
- `InventoryCostingService` fondasi moving average:
  policy ACTIVE per branch/company, event append-only, idempotency
  `operationKey` + `payloadHash`, CAS state version, backdated guard,
  `uncostedQuantity`, preview issue, replay source, dan `resolveMode`.
- `recordIssue` menolak pengeluaran tanpa biaya saat policy ACTIVE, sehingga
  aktivasi flag tidak dapat menghasilkan COGS parsial secara diam-diam.
- Goods receipt confirmation memanggil costing hanya bila flag
  `inventory.costing` aktif; movement menyimpan `occurredAt` dan
  `sourceLineKey = item.id`.
- Retur supplier (`confirmPurchaseReturn`) terintegrasi dengan keputusan
  **moving average + purchase price variance**:
  - inventory dikreditkan sebesar biaya ledger saat ACTIVE, bukan harga beli;
  - `recordIssue`-style `recordPurchaseReturn` memposting event
    `PURCHASE_RETURN` per item/batch dan mengisi `occurredAt` movement;
  - selisih `net - inventoryCost` diposting ke `4203` (keuntungan) atau
    `5103` (kerugian) sebagai additional journal line;
  - akun `4203`/`5103` dan rule `PURCHASE-RETURN` v2 (`inventory` amount key)
    ditambahkan ke seed dan migration expand-only idempotent;
  - SHADOW/legacy tetap mengkredit inventory sebesar `net`.
- Sales `create` terintegrasi:
  - mode costing diselesaikan setelah validasi stok;
  - SaleItem dibuat per baris agar ID dapat dipakai sebagai `sourceLineKey`;
  - FEFO batch consumption per baris; `recordIssue` per batch/non-batch;
  - `SaleItem.unitCost` dan `Sale.costTotal` dihitung ulang dari ledger;
  - jurnal memakai COGS aktual saat mode ACTIVE;
  - mode SHADOW tetap mencatat event tanpa mengubah COGS legacy.
- Retur penjualan (`confirmSaleReturn`) terintegrasi:
  - `postedAt` dipakai konsisten untuk movement, event, dan hasil transaksi;
  - ISSUE asli ditelusuri melalui `sourceLineKey` berbasis `SaleItem.id`;
  - kuantitas retur dialokasikan berurutan ke ISSUE asal, dikurangi offset
    retur yang sudah diposting;
  - `recordSaleReturn` memulihkan batch/cost state dan memposting event
    `SALE_RETURN`;
  - ACTIVE fail-closed bila referensi item/ISSUE/coverage tidak lengkap;
    SHADOW melewati costing dan tetap memakai COGS legacy;
  - jurnal HPP retur memakai biaya ledger saat ACTIVE.
- `orders.ship` memposting `ISSUE` per batch FEFO, menulis `occurredAt` pada
  movement, lalu memakai biaya ledger untuk jurnal COGS dan menulis ulang
  `OrderItem.unitCost` saat ACTIVE.
- `confirmOrderReturn` memulihkan biaya ISSUE pesanan asal per batch,
  menambah kembali quantity `InventoryBatch` asal, memposting `SALE_RETURN`,
  dan memakai nilai ledger untuk pembalikan COGS. ACTIVE fail-closed bila
  ISSUE pesanan asal tidak lengkap atau batch asal hilang.
- `shipTransfer` memposting `ISSUE` pada gudang asal dan
  `receiveTransfer` memposting `RECEIPT` tujuan dengan nilai ledger yang sama
  (proporsional untuk partial receipt); ACTIVE fail-closed bila event ISSUE
  asal tidak ada.
- `completeOpname` memakai biaya ledger: selisih negatif melalui `recordIssue`,
  selisih positif melalui `recordReceipt` pada average state saat ini; ACTIVE
  fail-closed bila tidak ada dasar biaya.
- `ManufacturingService.complete` memposting ISSUE komponen dan RECEIPT output
  pada biaya ledger; saat ACTIVE `Product.costPrice` tidak ditulis ulang.
- `AssetsService.completeMaintenance` memposting ISSUE part pada biaya ledger
  dan memakai nilainya untuk jurnal parts.
- `InventoryCostingPolicyService` + `InventoryCostingController` menyediakan
  daftar policy berpaginasi, pembuatan policy `DRAFT`, aktivasi, dan valuasi
  read-only per warehouse.
- Aktivasi policy memakai guard `effectiveFrom` maju, maker-checker melalui
  audit `COSTING_POLICY_CREATED`, CAS `updateMany` status `DRAFT`, dan audit
  `COSTING_POLICY_ACTIVATED`.
- Permission `inventory.costing.view`, `inventory.costing.manage`, dan
  `inventory.costing.rebuild` ditambahkan ke seed. ADMIN/FINANCE mendapat
  view/manage/rebuild, AUDITOR hanya view, WAREHOUSE tidak mendapat manage.
- `InventoryCostingRebuildService` menambahkan backfill snapshot:
  `POST /inventory/costing/rebuild` membuat run PENDING,
  `POST /inventory/costing/rebuild-runs/:id/approve` menjalankan snapshot
  dengan maker-checker, dan `GET /inventory/costing/rebuild-runs[/:id]`
  membaca status. `operationKey` unik + replay, flag wajib OFF, scope tanpa
  cost event/state, maksimum 5.000 baris, batch harus cocok dengan inventory.
- Rekonsiliasi sekarang menyertakan saldo akun `1301` per branch dan
  `valueDifferenceVsGl`; perbandingan dinonaktifkan untuk filter produk
  maupun gudang karena jurnal hanya memiliki dimensi branch.
- Engine FIFO/LIFO selesai: layer order, consumption/preview, CAS layer,
  sale return layer, policy method-aware, report/valuation method-aware.
- Backfill FIFO/LIFO membuat `OPENING` event + layer, bukan hanya state;
  `layersCreated` tercatat pada statistik run.
- Opname positif membaca state sesuai policy aktif, bukan hardcoded
  `MOVING_AVERAGE`.
- Retur pembelian FIFO/LIFO memprioritaskan layer dari receipt event asal
  melalui `goodsReceiptItemId` → `InventoryCostEvent` `GoodsReceipt`/`RECEIPT`;
  bila layer asal habis/tidak tersedia, konsumsi jatuh ke urutan FIFO/LIFO.
- `consumeProductBatchesFefo` mengembalikan alokasi batch
  `{ batchId, batchNumber, quantity }` agar costing memakai batch yang benar.
- Test fondasi dan runtime ditambahkan/diperbarui:
  `tests/w1-costing-engine-foundation.test.mjs` (schema/migration/service/
  goods receipt/sales/orders/sale return/order return/purchase return/
  transfer/opname/produksi/maintenance/ADR) dan
  `tests/w1-costing-sale-runtime.test.mjs` (ACTIVE FEFO, non-batch sentinel,
  penolakan uncosted atomik, pemulihan batch/cost retur penjualan, retur
  supplier moving-average + variance, order ship/return, transfer, opname,
  produksi, dan maintenance runtime), serta
  `tests/w1-costing-fifo-lifo-runtime.test.mjs` (FIFO/LIFO, layer asal retur
  pembelian, concurrency unit terakhir, backdated rejection, ACTIVE/SHADOW,
  report/valuation, replay receipt/issue, volume 2.000 layer dengan query plan
  berindeks, backfill opening).
- Baseline PostgreSQL diregenerasi (219314 byte) dan `db:baseline:postgres:check`
  PASS.

## Belum dikerjakan

- Replay event historis/rebuild penuh dengan checkpoint-resume; backfill
  snapshot saat ini dibatasi 5.000 baris dan sinkron.
- Jurnal opening/GL untuk snapshot dan aktivasi flag di database TEST.
- UI pemilihan metode dan persetujuan finance/tax untuk LIFO produksi.
- PostgreSQL migration rehearsal (butuh `T360_MIGRATION_DATABASE_URL`).
- Penerimaan backdated pada periode terbuka tanpa event setelahnya (jalur
  acceptance belum diuji terpisah); penolakan periode fiskal tertutup dan
  `AccountingCloseControl` sudah diuji. Concurrency/backdated rejection/replay
  receipt+issue/volume layer sudah tercakup runtime SQLite.
- Rollback drill dan bukti staging.

## Hasil quality gate

- `node scripts/workflow.mjs validate`: PASS 73 work item / 8 delivery wave.
- `npm run validate:repo`: PASS 1314 files / 208 Prisma models.
- `npm run quality:recorded:fast`: PASS **2038/2038 test**, lint,
  `db:local:prepare`, dan worker build
  (`logs/quality-fast-2026-10-22T06-43-11.150Z.log`).
- `node --test` costing 3 file: PASS 42/42 (16 static + 26 runtime) setelah
  atribusi layer asal retur pembelian, concurrency, backdated rejection,
  replay issue, volume 2.000 layer dengan query plan berindeks, dan penolakan
  sale pada periode fiskal tertutup maupun accounting close control tanpa
  mutasi parsial.
- `npm run db:migrations:rehearse:sqlite`: PASS 1 migration.
- `npm run db:baseline:postgres:check`: PASS (baseline sinkron).
- `git diff --check`: PASS setelah pembaruan handoff.

## Known issues

- `Product.costPrice` masih menjadi fallback saat costing OFF dan masih dipakai
  sales untuk `costTotal` legacy.
- Semua writer utama kini menulis state per `batchKey`; manufacturing output
  masih memakai `batchKey: ''`, sehingga produk output ber-batch perlu
  ditinjau sebelum flag ACTIVE diaktifkan.
- Policy ACTIVE melalui API belum mengaktifkan feature flag dan belum
  menjalankan rebuild/backfill; flag tetap harus dinyalakan terpisah setelah
  rekonsiliasi.
- Valuasi API hanya membaca state saat ini. Rekonsiliasi state vs Inventory,
  layer OPEN, dan akun `1301` sudah ada; perbandingan GL tidak tersedia saat
  filter produk/gudang aktif. FIFO/LIFO sudah berjalan, termasuk prioritas
  layer receipt asal untuk retur pembelian; UI pemilihan metode belum ada.
- Backfill snapshot memakai `Inventory` saat approval, bukan posisi pada
  `cutoverAt`; `cutoverAt`/`snapshotAt` dicatat di statistik. FIFO/LIFO
  membuat `OPENING` event + layer, tetapi belum ada jurnal opening,
  checkpoint-resume, atau run asinkron.
- Pesanan lama yang sudah dikirim sebelum integrasi ini tidak memiliki ISSUE
  event; retur order ACTIVE untuk pesanan tersebut akan fail-closed sampai
  backfill/opening dijalankan. Pada mode SHADOW/flag OFF tanpa trace, quantity
  batch fisik tidak dapat dipulihkan dan harus diselesaikan lewat backfill.
- Semua writer inventory utama sudah memanggil costing; writer baru wajib
  memakai pola event yang sama sebelum flag ACTIVE diaktifkan.
- Rule `PURCHASE-RETURN` v2 dan akun `4203`/`5103` harus terverifikasi pada
  company/branch existing sebelum flag ACTIVE diaktifkan; migration memakai
  `DO NOTHING` agar tidak menimpa konfigurasi yang sudah ada.
- `postManual` belum membandingkan payload; bukan blocker costing tetapi terkait
  audit jurnal.
- Payroll adjustment masih bypass accounting core (work item terpisah).
- Koreksi 2026-10-22: `config/workflow-policy.json` mengizinkan prefix
  `feature`; branch costing dibuat dan commit/push dilakukan atas permintaan
  user. Tiga file lama yang tidak terkait tetap tidak di-commit.
- Postgres migration rehearsal belum dapat dijalankan tanpa URL database TEST.

## Langkah aman berikutnya

1. Uji backfill + rekonsiliasi FIFO/LIFO pada database TEST dan putuskan
   jurnal opening bersama work item saldo awal.
2. Implementasikan replay event/rebuild penuh dengan checkpoint-resume, lalu
   concurrency/performance/staging.
