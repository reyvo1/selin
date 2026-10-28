# Session Handoff — T360-20261021-134133

- Checkpoint baseline: `RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF`
- Work item: `work-items/active/T360-20261021-134133-saldo-awal-dan-tutup-tahun.json`
- Branch saat ini: `feature/T360-20261021-134120-costing-engine-dan-valuasi`
  (belum di-carve ke branch opening; jangan commit campur sebelum dipisah)
- Branch yang disarankan: `feature/t360-20261021-134133-saldo-awal-dan-tutup-tahun`
- Phase: `IMPLEMENTATION` (sejak 2026-10-22)
- Owner: `architecture`

## Sudah dikerjakan

- Audit accounting core, opening stock, AR/AP, fiscal period, dan finance operations.
- ADR disetujui user 21 Oktober 2026:
  `docs/adr/ADR-T360-20261021-134133-OPENING-BALANCE-CUTOVER.md` (ACCEPTED).
- Desain: batch/row staging, dry-run, maker-checker, opening GL/stock/AR/AP,
  cutover gate, `postSystemJournal`/`postReversal`, year-end preview/approval/
  posting/reversal, report filter.
- Keputusan penting: opening AR/AP tidak membuat `TaxTransaction` baru;
  settlement memakai `OperationalFinanceTransaction`; outstanding (bukan total
  invoice) yang diposting; GL batch hanya akun residual; cutover gate memblokir
  operasi sampai rekonsiliasi lulus; closing memakai
  `incomeSummaryAccountCode`; rerun year-end memakai operation key berversi.
- Work item dinaikkan ke `IMPLEMENTATION` lewat workflow resmi.
- Fondasi accounting core selesai di
  `apps/api/src/accounting-core/accounting-core.service.ts`:
  - `postSystemJournal`: multi-line, `ruleId = null`, tanpa `TaxTransaction`,
    allowlist `OPENING_BALANCE`/`YEAR_END_CLOSE`, validasi branch/company,
    akun aktif dan scope, debit=kredit, nilai non-negatif, period lock,
    close control, payload hash, replay idempotent, dan audit
    `POST_SYSTEM_JOURNAL`.
  - `postReversal`: membalik debit/kredit, `reversalOfId`, `reversedAt`,
    menandai event/posting asal `REVERSED`, menolak reversal-of-reversal,
    period lock, replay idempotent, dan audit `POST_SYSTEM_REVERSAL`.
  - `assertPostingWindowOpen` diekstrak dan dipakai bersama oleh
    `postOperationalEvent`, `postSystemJournal`, dan `postReversal`.
- Test `tests/w3-opening-year-end-foundation-runtime.test.mjs` **5/5 PASS**:
  balanced multi-line + idempotency, validasi baris/tenant/akun, close control
  dan period lock, reversal + penolakan retry divergen/reversal kedua,
  serta reversal di periode tertutup tanpa mutasi original.
- Schema/migration opening selesai: enam model dan empat enum ditambahkan
  field-for-field ke tiga Prisma schema, dengan unique key batch/ledger/run dan
  partial unique `YearEndCloseRun_posted_scope_key` untuk satu run `POSTED`
  per company/branch/fiscal year.
- Migration expand-only
  `database/migrations/T360-20261021-134133-opening-balance-year-end/`
  (`README.md`, `sqlite-expand.sql`, `postgresql-expand.sql`) terdaftar di
  `config/expand-migration-order.json`, tanpa backfill otomatis.
- Baseline PostgreSQL diregenerasi; partial unique index dimasukkan lewat
  `database/postgresql/post-migration/002-opening-year-end-posted-scope.sql`
  karena Prisma tidak dapat mengekspresikannya di schema.
- Static test `tests/w3-opening-year-end-foundation.test.mjs` **5/5 PASS**;
  `tests/prisma-schema-field-parity.test.mjs` **4/4 PASS**; baseline test
  **6/6 PASS**; SQLite migration rehearsal PASS; `db:local:prepare` PASS;
  `prisma validate` SQLite dan PostgreSQL PASS (PostgreSQL memakai URL dummy).
- Service staging/approval selesai di `apps/api/src/opening-balance/`:
  - Endpoint `GET/POST accounting/opening-balance` untuk list, detail, rows,
    preview, create, revalidate, submit, approve, dan cancel; pagination
    cursor, tenant/branch scope dari `AuthUser`, audit, dan idempotency.
  - Permission `accounting.opening.view`, `accounting.opening.import`, dan
    `accounting.opening.approve` ditambahkan ke seed dan diberikan ke
    FINANCE/OWNER/SUPER_ADMIN; AUDITOR view-only.
  - Feature flag `accounting.opening_and_year_end` ditegakkan pada write,
    bukan dry-run. Resolusi memakai branch > company > global; flag disabled
    pada scope spesifik meng-override global enabled.
  - CSV canonical parser in-house (quoted field, escaped quote, CRLF, BOM,
    alias header, duplicate/unknown header, NUL/binary/PK rejection, limit
    1.000 baris, error maksimal 100 + `errorsTruncated`). XLSX/XLS ditolak
    eksplisit sampai parser disetujui.
  - Validasi STOCK, AR, AP, dan GL: tenant/branch, produk/gudang/lokasi,
    batch/expiry/serial, customer/supplier, due date, tax snapshot/version,
    control account, outstanding, duplikat dokumen, dan keseimbangan GL.
  - Idempotency `create` memakai `(companyId, operationKey)` + checksum;
    replay dicek sebelum validasi referensi sehingga retry tetap stabil.
    Duplikat dokumen AR/AP mengecek `OpeningLedgerDocument` dan staged row
    dari batch lain; revalidate mengecualikan batch sendiri.
  - `revalidate` memakai CAS `status + updatedAt`, lalu mengganti row secara
    atomik; perubahan bersamaan ditolak `OPENING_BATCH_STATE_CHANGED`.
  - Status flow staging: `VALIDATED`/`FAILED` → `WAITING_APPROVAL` →
    `APPROVED`; maker-checker dan cancel sebelum `APPROVED` ditegakkan.
  - `tests/w3-opening-balance-staging-runtime.test.mjs` **13/13 PASS**,
    termasuk feature flag precedence, cancel/replay, tax snapshot AR, AP
    credit, keseimbangan GL, approval maker-checker, revalidasi, penolakan
    akun P&L, posting GL, dan konflik control account.
- Posting GL selesai di `POST accounting/opening-balance/batches/:id/post`
  dengan permission `accounting.opening.post`:
  - Hanya batch `APPROVED` bertipe GL; transisi `APPROVED → POSTING → POSTED`
    dalam satu transaksi serializable, sehingga kegagalan tidak meninggalkan
    status `POSTING`.
  - Memanggil `AccountingCoreService.postSystemJournal` dengan operation key
    `opening-gl:<batchId>`, source `OPENING_BALANCE_BATCH`, business date
    cutover, dan `ruleId = null`; baris ditandai `POSTED`, batch mendapat
    `postedAt`, dan audit `OPENING_BALANCE_BATCH_POSTED` dicatat.
  - GL hanya menerima akun ASSET/LIABILITY/EQUITY dan menolak akun kontrol
    yang sudah dicakup batch STOCK/AR/AP pada cutover yang sama.
  - Posting ulang mengembalikan batch yang sama tanpa menggandakan event atau
    jurnal; feature flag OFF memblokir posting.
- `npm run quality:recorded:fast` PASS **2061/2061**
  (`logs/quality-fast-2026-10-22T09-00-52.236Z.log`); lint workspace dan API
  typecheck PASS.

## Belum dikerjakan

- Posting opening stock/AR/AP (termasuk checkpoint, reversal, dan penulisan
  `OpeningLedgerDocument`); endpoint/worker post/reverse untuk tipe tersebut.
- Reversal batch GL yang sudah `POSTED`; saat ini replay aman tetapi reversal
  belum diekspos.
- Perluasan `CUSTOMER_RECEIPT`/`SUPPLIER_PAYMENT` untuk `OpeningLedgerDocument`
  dan `OpeningLedgerSettlement`.
- Integrasi saldo awal stok dengan costing/backfill dan inventory movement
  append-only.
- Cutover gate, reconciliation report, aging union, dan report filter.
- Year-end preview/approval/posting/reversal dan period lock.
- Permission/feature-flag HTTP guard runtime test; test saat ini memanggil
  service langsung. Concurrency dua approver/posting belum diuji.
- Performance test, PostgreSQL migration rehearsal nyata, staging/UAT,
  rollback drill, dan Human Stage-20.

## Hasil quality gate

- `npm run workflow:validate`: PASS 73 work item / 8 delivery wave.
- `npm run validate:repo`: PASS **1325 files / 214 Prisma models**.
- `npm run quality:recorded:fast`: PASS **2061/2061** test, lint,
  `db:local:prepare`, dan worker build
  (`logs/quality-fast-2026-10-22T09-00-52.236Z.log`).
- `npx tsc --noEmit -p apps/api/tsconfig.json`: PASS.
- `npm run lint --workspaces --if-present`: PASS.
- `git diff --check`: PASS setelah pembaruan handoff.

## Known issues

- Implementasi opening baru staging/approval + posting GL; belum ada posting
  AR/AP/STOCK, reversal batch posted, settlement, cutover gate, atau tutup
  tahun. Jangan mengklaim seluruh posting atau tutup tahun tersedia.
- Feature flag tidak dicek di core karena reversal harus tetap berfungsi saat
  flag OFF; enforcement dilakukan di boundary API.
- Race dua `create` paralel dengan dokumen sama masih dapat lolos validasi
  staged-row sebelum salah satu batch tersimpan; unique constraint final baru
  berlaku saat `OpeningLedgerDocument` dibuat pada posting.
- CSV parser belum menangani Excel dan beberapa edge case angka/locale;
  parser `xlsx` tetap menunggu review dependency.
- `isActive` masih di-select untuk product/warehouse/location tetapi belum
  dipakai; `stageValidation` melakukan query account dua kali. Ini cleanup
  non-blocking.
- Payroll adjustment masih membuat jurnal langsung; dinyatakan **di luar
  cutover opening**, tetapi tetap blocker klaim tutup tahun production-ready.
- `postManual` belum membandingkan payload; terkait audit jurnal.
- Aging AR/AP masih dibatasi 500 baris; harus diselesaikan sebelum opening
  produksi.
- Perubahan opening saat ini berada di branch costing dan bercampur dengan
  perubahan costing yang belum di-commit; pisahkan branch/commit sebelum UAT.
- Push/commit ditahan sampai perintah eksplisit user (UAT di Git).

## Langkah aman berikutnya

1. Implementasikan reversal batch GL `POSTED` melalui `postReversal`, lalu
   posting AR/AP (`OpeningLedgerDocument`, outstanding, settlement via
   `OperationalFinanceTransaction`).
2. Lanjut posting STOCK (inventory movement append-only + costing layer) dengan
   checkpoint/reversal.
3. Tambahkan cutover gate, reconciliation report, aging union, lalu year-end
   preview/approval/posting/reversal.
4. Tambahkan HTTP guard/permission/concurrency test; jalankan PostgreSQL
   migration rehearsal (butuh `T360_MIGRATION_DATABASE_URL`), staging/UAT, dan
   rollback drill sebelum status release.
