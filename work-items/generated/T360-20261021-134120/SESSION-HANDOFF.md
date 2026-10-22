# Session Handoff — T360-20261021-134120

- Checkpoint baseline: `RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF`
- Work item: `work-items/active/T360-20261021-134120-costing-engine-dan-valuasi-persediaan.json`
- Branch: `feature/t360-20261021-134120-costing-engine-dan-valuasi-persediaan`
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
  `inventory.costing.rebuild` ditambahkan ke seed; `rebuild` masih reserved
  karena endpoint rebuild belum ada.
- `consumeProductBatchesFefo` mengembalikan alokasi batch
  `{ batchId, batchNumber, quantity }` agar costing memakai batch yang benar.
- Test fondasi dan runtime ditambahkan/diperbarui:
  `tests/w1-costing-engine-foundation.test.mjs` (schema/migration/service/
  goods receipt/sales/orders/sale return/order return/purchase return/
  transfer/opname/produksi/maintenance/ADR) dan
  `tests/w1-costing-sale-runtime.test.mjs` (ACTIVE FEFO, non-batch sentinel,
  penolakan uncosted atomik, pemulihan batch/cost retur penjualan, retur
  supplier moving-average + variance, order ship/return, transfer, opname,
  produksi, dan maintenance runtime).
- Baseline PostgreSQL diregenerasi (219314 byte) dan `db:baseline:postgres:check`
  PASS.

## Belum dikerjakan

- Rebuild SHADOW/backfill dan endpoint rebuild/rebuild-runs.
- Rekonsiliasi vs GL dan layer explorer FIFO/LIFO; layer/reconciliation
  state vs Inventory sudah tersedia read-only.
- FIFO/LIFO layer/consumption masih ditolak service; P0 baru moving average.
- Negative stock policy dan penanganan state negatif end-to-end.
- PostgreSQL migration rehearsal (butuh `T360_MIGRATION_DATABASE_URL`).
- Integration/concurrency/performance test khusus costing dan staging/UAT.
- Rollback drill dan bukti staging.

## Hasil quality gate

- `node scripts/workflow.mjs validate`: PASS 73 work item / 8 delivery wave.
- `npm run validate:repo`: PASS 1312 files / 208 Prisma models.
- `npm run quality:fast`: PASS 2025/2025 test, lint, `db:local:prepare`,
  dan worker build.
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
- Valuasi API hanya membaca state saat ini. Rekonsiliasi state vs Inventory
  dan layer OPEN sudah ada; rekonsiliasi vs GL belum, dan layer FIFO/LIFO
  belum diimplementasikan.
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

1. Implementasikan rebuild SHADOW/backfill ISSUE untuk pesanan/transfer lama
   dan opening cost state.
2. Rekonsiliasi vs GL, lalu uji aktivasi flag pada database TEST.
