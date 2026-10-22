# ADR T360-20261021-134133 — Saldo awal dan tutup tahun

**Status:** ACCEPTED — disetujui 2026-10-21; implementasi dimulai.

**Date:** 2026-10-21

**Work item:** `T360-20261021-134133-saldo-awal-dan-tutup-tahun`

**Dependency:** `T360-20261021-134120-costing-engine-dan-valuasi-persediaan`

## Context

Toko360 sudah memiliki accounting core dengan jurnal seimbang, posting rule
berversi, idempotency, fiscal period, dan close control. Namun saldo awal dan
tutup tahun belum operasional:

- `InventoryMovementType.OPENING_STOCK` ada di `schema.prisma:184-199`, tetapi
  hanya dipakai seed (`apps/api/prisma/seed.ts:291-302`); tidak ada API,
  batch, nilai, atau layer biaya.
- Saldo awal akuntansi hanya bisa lewat `postManual`
  (`apps/api/src/accounting-core/accounting-core.service.ts:798-856`) yang
  berbasis posting rule dan tidak menerima multi-line journal bebas.
- Belum ada model opening AR/AP per invoice. Aging dibangun dari `Order`,
  `Sale`, `GoodsReceipt`, dan sumber operasional lain di
  `apps/api/src/finance-operations/finance-operations.service.ts:317-651`,
  dengan cap 500 dokumen dan due date dari `Supplier.paymentTermDays`, bukan
  due date per invoice.
- `FiscalPeriod` dan `AccountingCloseControl` sudah mengunci posting
  (`schema.prisma:2079-2092`, `:3622-3638`; pengecekan di
  `accounting-core.service.ts:677-705`), tetapi belum ada closing entries,
  laba ditahan, opening tahun berikut, atau reversal API.
- `AccountingEvent.reversalOfId` dan `AccountingPosting.reversedAt` ada
  (`schema.prisma:3478`, `:3540`), tetapi belum dipakai.
- `FeatureFlag` `accounting.opening_and_year_end` belum ditegakkan.
- Payroll adjustment membuat jurnal langsung di
  `apps/api/src/payroll/payroll.service.ts:1302-1323`, melewati period lock
  dan posting rule. Ini harus diperbaiki sebelum klaim tutup tahun aman.

Keputusan user 21 Oktober 2026:

- Saldo awal diimpor sebagai batch CSV/Excel, dry-run, approval maker-checker,
  dan koreksi manual terbatas.
- Tutup tahun memakai preview worksheet, approval, lalu auto-post closing
  entries; opening tahun berikut berupa snapshot saldo akhir, bukan jurnal
  duplikat.

## Decision

### 1. Prinsip

- Semua jurnal tetap dibuat oleh accounting core. Tidak ada modul yang menulis
  `JournalEntry`/`JournalLine` sendiri.
- Opening dan closing adalah event sistem dengan `ruleId = null`; bukan
  posting rule baru yang dapat diedit bebas.
- Posting harus idempotent, menghormati period lock, dan tidak mengedit jurnal
  yang sudah posted.
- Saldo awal tidak boleh memakai data produksi sebagai data test.
- Subledger (stock, AR, AP) harus tie-out ke control account dan trial balance.
- Maker-checker wajib: pembuat batch/run tidak boleh menjadi approver.

### 2. Model data

Model baru:

- `OpeningBalanceBatch`
  - `companyId`, `branchId`, `type` (`STOCK`, `AR`, `AP`, `GL`),
    `cutoverDate`, `sourceFileName`, `sourceChecksum`, `status`,
    `operationKey`, `controlAccountCode`, `offsetAccountCode`,
    `suspenseAccountCode`, `sourceStorageKey`, `retentionUntil`,
    `totalDebit`, `totalCredit`, `rowCount`, `validRowCount`,
    `errorRowCount`, `createdBy`, `approvedBy`, `postedAt`.
  - Unique `(companyId, operationKey)`.
  - Status: `DRAFT`, `VALIDATING`, `VALIDATED`, `WAITING_APPROVAL`,
    `APPROVED`, `POSTING`, `POSTED`, `FAILED`, `CANCELLED`.
- `OpeningBalanceRow`
  - `batchId`, `rowNumber`, `status`, `payloadHash`, `rawPayload`.
  - STOCK: `productId`, `warehouseId`, `locationCode?`, `batchNumber?`,
    `expiryDate?`, `quantity`, `unitCost`. Varian belum menjadi dimensi stok;
    jangan menerima `variantId` sampai schema inventory mendukungnya.
  - AR/AP: `customerId?`, `supplierId?`, `documentNumber`, `documentDate`,
    `dueDate`, `subtotal`, `taxCodeId?`, `taxCodeVersion?`,
    `taxRateSnapshot?`, `taxAmount`, `total`, `paidAmount`. Wajib tepat satu
    dari `customerId`/`supplierId`, dan `kind` harus cocok dengan pihaknya.
  - GL: `accountCode`, `debit`, `credit`, `description`.
  - Error: `errorCode`, `errorMessage`.
- `OpeningLedgerDocument`
  - AR/AP per invoice, terhubung ke `OpeningBalanceRow`.
  - `companyId`, `branchId`, `kind`, `customerId/supplierId`,
    `documentNumber`, `documentDate`, `dueDate`, `subtotal`, `taxAmount`,
    `total`, `paidAmount`, `settledAmount`, `outstandingAmount`,
    `controlAccountCode`, `taxCodeId`, `status` (`OPEN`,
    `PARTIALLY_SETTLED`, `SETTLED`, `WRITTEN_OFF`).
  - Unique `(companyId, branchId, kind, documentNumber)`.
- `OpeningLedgerSettlement`
  - Pembayaran/settlement opening invoice, terhubung ke
    `OperationalFinanceTransaction`.
  - `companyId`, `branchId`, `documentId`, `financeTransactionId`, `amount`,
    `settledAt`, `status`, `operationKey`.
  - Unique `(companyId, branchId, operationKey)` dan unique `(documentId,
    financeTransactionId)`.
- `YearEndCloseRun`
  - `companyId`, `branchId`, `fiscalYear`, `status`,
    `retainedEarningsAccountCode`, `incomeSummaryAccountCode`, `netIncome`,
    `totalDebit`, `totalCredit`,
    `previewJson`, `operationKey`, `approvedBy`, `postedAt`,
    `journalEntryId?`, `reversalEventId?`.
  - Unique `(companyId, branchId, fiscalYear, operationKey)`.
  - Invariant: maksimal satu run `POSTED` per company/branch/fiscalYear;
    ditegakkan service + partial unique index di migration.
- `YearEndCloseLine`
  - `runId`, `accountCode`, `debit`, `credit`, `lineType`, `description`.
  - Menyimpan preview dan hasil posting untuk audit.

Semua model ada di tiga schema Prisma dan migration expand-only. Tidak ada
perubahan destruktif pada tabel lama.

### 3. Accounting core: system journal dan reversal

Tambahkan dua method di accounting core:

1. `postSystemJournal`
   - Menerima multi-line debit/kredit, `eventType` (`OPENING_BALANCE`,
     `YEAR_END_CLOSE`), `sourceType`, `sourceId`, `idempotencyKey`,
     `businessDate`, dan `branchId`.
   - Validasi tenant/branch, account aktif dan scope, debit=kredit, period lock,
     close control, payload hash, dan allowlist `eventType`/`sourceType`
     (`OPENING_BALANCE`/`YEAR_END_CLOSE`).
   - Membuat `AccountingEvent`, `JournalEntry`, `JournalLine`,
     `AccountingPosting` dengan `ruleId = null`, dan event lines ringkasan.
   - Tidak memakai posting rule; tidak boleh dipanggil dari luar accounting
     core.
2. `postReversal`
   - Membuat event pembalik dengan `reversalOfId` dan `eventType` yang
     sesuai.
   - Menandai `AccountingPosting.reversedAt` dan status event asal
     `REVERSED`.
   - Tidak mengedit atau menghapus jurnal asal.
   - Reversal harus berada di periode terbuka; bila periode sudah `CLOSED`,
     gunakan prior-period adjustment di periode berikutnya dengan approval.
   - Pada P0 `postReversal` dibatasi untuk event `OPENING_BALANCE` dan
     `YEAR_END_CLOSE`; reversal transaksi operasional tetap memakai alur
     dokumen asal.

`postOperationalEvent` tetap menjadi jalur utama untuk transaksi operasional.
`postSystemJournal` hanya untuk opening/closing yang memang tidak punya
posting rule.

### 4. Alur opening GL

- Batch GL berisi baris `accountCode`, debit, kredit.
- Validasi: total debit = total kredit; akun ada dan aktif; scope
  company/branch benar; tidak ada baris negatif; cutover date berada di
  periode terbuka.
- Preview menampilkan trial balance dan selisih. Jika tidak seimbang, batch
  tidak boleh `VALIDATED`; jika ada baris tak jelas, gunakan suspense account
  dan laporkan.
- Posting memakai `postSystemJournal` dengan operation key
  `opening-gl:<batchId>`.
- Koreksi setelah posting memakai batch `CORRECTION`/reversal, bukan edit.
- Opening GL tidak boleh memakai akun revenue/expense; hanya balance sheet.
  Jika ada laba/rugi opening, arahkan ke opening equity/retained earnings
  sesuai mapping yang disetujui.
- GL batch adalah akun residual. Akun inventory/AR/AP control yang sudah
  dicakup batch STOCK/AR/AP tidak boleh diposting ulang di GL; jika terpaksa
  dimasukkan untuk rekonsiliasi, tandai `reconciliationOnly` dan jangan
  posting.

### 5. Alur opening stock

- Batch STOCK berisi per warehouse/product/batch: qty, unit cost, batch,
  expiry, dan lokasi default bila produk memakai location stock.
- Dependency costing harus ACTIVE/SHADOW sesuai mode; bila costing belum siap,
  batch STOCK ditolak dengan error eksplisit.
- Validasi: produk/warehouse/batch ada; warehouse dan `locationCode` berada di
  branch batch; qty > 0; unit cost >= 0; tidak ada duplikat; total nilai =
  qty × unit cost; batch/expiry konsisten; `trackBatch` mewajibkan batch
  number, non-batch menolak batch number.
- Posting per baris dalam transaksi serializable:
  - Buat `InventoryMovement` tipe `OPENING_STOCK` dengan `occurredAt =
    cutoverDate` dan `balanceAfter`.
  - Naikkan `Inventory.quantity` dan `Inventory.available`; perbarui
    location/condition balance melalui helper yang sama dengan receipt
    (`depositLocationStock` atau pengganti yang setara), lalu upsert
    `InventoryBatch` bila batch-tracked.
  - Panggil costing service untuk membuat opening state/layer pada unit cost.
  - Tandai row `POSTED`; simpan checkpoint.
- Setelah semua row sukses, posting GL:
  - Debit `controlAccountCode` (default `1301`), kredit offset/suspense
    account.
  - Total GL = total nilai baris.
  - Selama batch `POSTING`, report finansial menandai opening in-progress dan
    tidak boleh dipakai sebagai bukti trial balance final.
- Jika posting GL gagal, batch tetap `POSTING` dan dapat di-retry; row sudah
  idempotent. Jika batch dibatalkan, buat reversal inventory/GL, bukan hapus
  movement.
- Opening stock tidak boleh menimpa stok existing; batch adalah penambah saldo
  awal pada cutover, bukan reset.

### 6. Alur opening AR/AP

- Batch AR/AP berisi invoice per customer/supplier: nomor, tanggal, due date,
  subtotal, pajak, total, paid amount.
- Validasi: customer/supplier ada dan `companyId` cocok (atau dimigrasikan
  eksplisit); nomor unik per company/branch/kind; total = subtotal + pajak;
  paid <= total; document date <= cutover date; due date >= document date;
  tax code/versi sesuai tanggal dokumen (bukan hanya status ACTIVE hari ini);
  tidak ada duplikat.
- Posting:
  - Buat `OpeningLedgerDocument` untuk setiap invoice.
  - Posting GL agregat memakai **outstanding**, bukan total invoice: AR debit
    `controlAccountCode`, kredit offset; AP debit offset, kredit
    `controlAccountCode`. `paidAmount` sebelum cutover tidak boleh diposting
    lagi sebagai kas/utang.
  - Outstanding = total - paidAmount - settledAmount. `paidAmount` adalah
    pembayaran sebelum cutover; settlement setelah cutover dicatat terpisah.
  - Jika komponen pajak opening masih menjadi kewajiban/piutang, reklas dari
    offset ke akun pajak dilakukan di GL batch dengan approval; opening AR/AP
    tidak membuat `TaxTransaction`.
  - Opening AR/AP **tidak** membuat `TaxTransaction` baru. Pajak historis
    hanya divalidasi dan disimpan sebagai snapshot agar tidak dihitung dua
    kali; kebutuhan carry-forward pajak menjadi batch terpisah dengan
    persetujuan.
- Aging/receivables/payables wajib memasukkan opening document dan memakai
  due date per invoice, bukan `Supplier.paymentTermDays`.
- Settlement setelah cutover memakai `OpeningLedgerSettlement` dan
  `OperationalFinanceTransaction`; tidak membuat `Sale`/`GoodsReceipt`
  sintetis.
- `CUSTOMER_RECEIPT` dan `SUPPLIER_PAYMENT` di finance operations diperluas
  untuk menerima `referenceType = OpeningLedgerDocument`; snapshot
  receivable/payable membaca outstanding opening document, dan transaksi
  finansial memperbarui `settledAmount`/`outstandingAmount` secara atomik.
- Subledger AR/AP harus tie-out ke control account. Selisih masuk suspense
  dan tidak boleh diabaikan.

### 7. Cutover gate

- Cutover freeze: normal posting untuk company/branch ditahan selama batch
  opening diproses; tanggal cutover harus berada di periode `OPEN`.
- Gate wajib lulus sebelum operasi normal dibuka:
  - semua batch STOCK/AR/AP/GL untuk cutover date `POSTED`;
  - trial balance debit=kredit;
  - AR/AP subledger = control account;
  - inventory qty/value = cost state/layer = inventory control;
  - tidak ada row `FAILED`, `POSTING`, atau `WAITING_APPROVAL`.
- Bila gate gagal, periode tetap ditahan dan batch dapat dilanjutkan/direversal;
  jangan menutup selisih dengan jurnal manual tanpa approval.
- Gate dan hasil rekonsiliasi disimpan sebagai evidence cutover.

### 8. Tutup tahun

Alur:

1. **Preview**: Hitung saldo revenue/expense untuk fiscal year; hasilkan
   closing lines: tutup revenue ke `incomeSummaryAccountCode`, tutup expense
   ke `incomeSummaryAccountCode`, tutup net income ke
   `retainedEarningsAccountCode`. Simpan `YearEndCloseLine`.
2. **Validasi**: trial balance seimbang; tidak ada event PENDING/VALIDATED;
   tidak ada finance transaction DRAFT/WAITING_APPROVAL; tidak ada tax
   transaction CALCULATED; opening batch terkait sudah POSTED; subledger
   tie-out; `FiscalPeriod` untuk tahun berjalan ada dan `OPEN`; period lock
   sesuai. Preview wajib dihitung ulang tepat sebelum posting.
3. **Approval**: maker-checker; approver tidak sama dengan pembuat.
4. **Auto-post**: `postSystemJournal` dengan operation key
   `year-end-close:<company>:<branch>:<year>:v1`. Rerun setelah reversal
   memakai versi baru (`v2`, `v3`, ...) dan `reversalOfId`; operation key lama
   tidak boleh dipakai ulang.
5. **Period lock**: setelah posting, soft close lalu final close. Posting
   closing entries harus berada di periode terbuka; final close tidak boleh
   mendahului posting.
6. **Opening tahun berikut**: karena ledger kontinu, saldo awal tahun berikut
   adalah saldo akhir tahun berjalan. Tidak membuat jurnal opening duplikat.
   Preview/snapshot opening tahun berikut disediakan sebagai laporan.
7. **Reversal**: bila periode masih `SOFT_CLOSED`, reopen dengan alasan,
   reversal closing event, lalu jalankan ulang. Bila sudah `CLOSED`, reversal
   dilakukan sebagai prior-period adjustment di periode berikutnya dengan
   approval; tidak reopen paksa.

`YearEndCloseRun` menyimpan preview, approver, journal, dan reversal. Tidak ada
closing entry yang diedit langsung. Satu run adalah satu branch; company-wide
consolidation bukan bagian P0.

### 9. Dampak report

- `profitLoss` dan perhitungan current earnings di `balanceSheet` harus
  mengecualikan journal dari event `YEAR_END_CLOSE`; jika tidak, P&L akan
  terdistorsi.
- `balanceSheet` memisahkan current-year earnings dan retained earnings.
- `trialBalance` tetap memuat closing entries karena fungsinya menampilkan
  saldo akhir.
- `financialIntegrity` menambah:
  - trial balance debit=kredit;
  - AR/AP subledger vs control account;
  - inventory valuation vs GL inventory;
  - opening batch row status vs GL total;
  - closing run status vs journal.
- `fiscalCloseBlockers` menambah opening batch yang belum posted, closing run
  yang belum selesai, selisih subledger, dan batch opening yang masih
  `POSTING`.
- Report AR/AP tidak boleh memakai cap 500 in-memory; gunakan query database
  dengan pagination/agregasi, termasuk union opening document.

### 10. API dan UI

API:

- `POST /accounting/opening-balances` (upload/metadata batch; file disimpan
  di private storage dengan checksum dan retensi, bukan di log)
- `GET /accounting/opening-balances`, `GET /:id`
- `POST /:id/validate`, `POST /:id/approve`, `POST /:id/post`,
  `POST /:id/cancel`
- `GET /accounting/opening-balances/:id/reconciliation`
- `POST /accounting/year-end-close/preview`
- `GET /accounting/year-end-close/:id`
- `POST /:id/approve`, `POST /:id/post`, `POST /:id/reverse`
- `GET /accounting/reports/opening-reconciliation`,
  `GET /accounting/reports/closing-worksheet`

Format kanonik adalah CSV. Excel hanya didukung setelah parser (misalnya
`xlsx`) ditambahkan dengan review dependency dan test; bila belum disetujui,
UI mengonversi Excel ke CSV sebelum upload.

UI Admin Finance:

- Wizard opening: upload, mapping, dry-run, validation table, approval,
  posting, reconciliation.
- Year-end: preview worksheet, adjusting entries, approval, posting, period
  close, reversal.
- Riwayat batch/run dengan status, error, dan audit.
- Tidak ada UI POS.

### 11. Feature flag dan permission

- Flag `accounting.opening_and_year_end` wajib dicek server-side; flag OFF
  menyembunyikan endpoint dan memblokir posting.
- Permission baru:
  - `finance.opening.import`
  - `finance.opening.approve`
  - `finance.opening.post`
  - `finance.opening.reverse`
  - `finance.year_end.preview`
  - `finance.year_end.approve`
  - `finance.year_end.post`
  - `finance.year_end.reverse`
- Role `FINANCE`/`OWNER`/`SUPER_ADMIN`; approver terpisah dari pembuat.
- Audit event untuk upload, validate, approve, post, cancel, reverse, dan
  perubahan mapping.

### 12. Batch dan idempotency

- Upload batch memakai `operationKey` dan `sourceChecksum`; file yang sama
  tidak membuat batch ganda.
- Row memakai `payloadHash`; baris yang sama dalam batch yang sama tidak
  diproses dua kali.
- Posting batch memakai checkpoint per row; worker dapat melanjutkan setelah
  gagal.
- Posting GL dan closing memakai operation key unik.
- Replay dengan payload berbeda ditolak, bukan silent success.

### 13. Migration dan rollback

- Migration expand-only untuk semua tabel baru; tidak ada backfill otomatis
  ke saldo final.
- Import dijalankan dry-run di staging dengan data sintetis; cutover memakai
  freeze dan snapshot.
- Baseline PostgreSQL diregenerasi dan diuji.
- Rollback: flag OFF, hentikan batch, restore snapshot bila perlu; posting yang
  sudah ada dibalik dengan reversal/compensating, bukan delete.
- Bila batch gagal di tengah, row yang sudah posted tetap ada dan dapat
  direkonsiliasi; batch tidak boleh ditandai POSTED sebelum GL selesai.

## Consequences

- Saldo awal menjadi auditabel per batch/row/invoice, bukan jurnal manual
  yang tidak dapat ditelusuri.
- Tutup tahun menghasilkan jurnal yang dapat diuji dan reversal, bukan hanya
  status periode.
- Report AR/AP dan financial integrity harus diubah; ini menambah scope
  reporting.
- Metode LIFO/costing harus selesai sebelum opening stock ACTIVE.
- Payroll adjustment bypass dan `postManual` idempotency yang lemah harus
  diperbaiki sebelum klaim production-ready. Payroll bypass perlu work item
  terpisah; jangan menyatakan tutup tahun aman selama bypass masih ada.
- Data historis yang tidak lengkap masuk suspense; tidak direkayasa menjadi
  saldo final tanpa approval.

## Security and operational impact

- Import file dan data pelanggan/supplier dibatasi permission finance; log
  tidak memuat isi file mentah atau data pribadi. File mentah disimpan di
  private storage dengan retensi terbatas; `OpeningBalanceRow` hanya menyimpan
  field yang diperlukan.
- Maker-checker, audit, period lock, dan tenant/branch scope wajib.
- Monitoring: status batch/run, row error, suspense balance, trial balance
  difference, subledger vs control, closing job latency, dan reversal.
- Alert bila trial balance tidak seimbang, subledger selisih, batch gagal
  berulang, atau closing run tertahan.
- Tidak ada credential/token di file opening.

## Test plan

- Import: CSV/Excel valid/invalid, duplikat, baris kosong, angka negatif,
  pajak, due date, batch/expiry.
- Dry-run: tidak mengubah stok/jurnal; hasil validasi deterministik.
- Opening stock: qty/value tie-out ke cost state/layer dan GL.
- Opening AR/AP: subledger = control account; aging per invoice.
- Opening GL: debit=kredit; account scope; suspense.
- Tutup tahun: preview, approval, posting, soft close, final close, reversal.
- P&L/balance sheet: closing entries tidak mendistorsi current earnings.
- Idempotency: upload, validate, post, closing, reversal.
- Concurrency: dua approver, dua posting batch, duplicate row.
- Period lock: posting ke periode tertutup ditolak; reversal sesuai status.
- Security: tenant isolation, permission, maker-checker, audit.
- Performance: import 10k+ row, report aggregation, checkpoint resume.
- Migration: SQLite/PostgreSQL rehearsal dan baseline check.

## Out of scope

- Migrasi historis penuh dari IPOS (PKG-11).
- Multi-currency, konsolidasi, tax return, dan e-faktur.
- Payroll adjustment bypass; perlu work item terpisah.
- Sync lintas node; opening/closing belum disinkronkan.
- COA per gudang (PKG-10); desain ini memakai COA existing per branch.
- Settlement cek/BG dan deposit (PKG-07/08) di luar opening invoice dasar.

## Implementation phases

1. `postSystemJournal`/`postReversal` + permission + flag enforcement.
2. Opening GL + batch/row/validation/approval.
3. Opening AR/AP + settlement + aging union.
4. Opening stock integration dengan costing.
5. Year-end preview/approval/posting/reversal + report filters.
6. Reconciliation, performance, staging, dan Human Stage-20 evidence.
