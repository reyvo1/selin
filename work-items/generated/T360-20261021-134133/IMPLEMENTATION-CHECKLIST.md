# Implementation Checklist — T360-20261021-134133

## Analysis

- [x] Baca work item dan seluruh dokumen sumber.
- [x] Audit implementasi yang sudah ada; jangan membuat modul duplikat.
- [x] Tetapkan system of record, state machine, invariant, dan failure modes.
- [x] Konfirmasi dampak database, inventory, accounting, tax, payment, payroll, sync, security, dan performance.

## Design

- [x] Tetapkan API/DTO/event contract (lihat ADR opening/closing).
- [x] Tetapkan permission dan tenant/branch scope.
- [x] Tetapkan idempotency key serta retry behavior.
- [x] Tetapkan migration, index, pagination, retention, dan rollback.
- [x] Tetapkan accounting/tax posting rule bila relevan.
- [x] User/owner menyetujui ADR sebelum IMPLEMENTATION (2026-10-21).

## Implementation

- [x] Implementasi kecil dan modular: fondasi `postSystemJournal`/`postReversal` di accounting core.
- [x] Hindari jurnal, pajak, stok, atau notification logic tersebar di modul; jurnal sistem tetap dibuat accounting core.
- [x] Audit event `POST_SYSTEM_JOURNAL`/`POST_SYSTEM_REVERSAL` dan error validasi tenant/akun/periode.
- [x] Enforce permission view/import/approve/post dan feature flag `accounting.opening_and_year_end` pada boundary API staging + posting GL.
- [ ] Enforce permission reverse dan worker posting AR/AP/STOCK/closing.
- [x] Tambahkan schema staging, service batch, DTO, controller, dan CSV dry-run.
- [ ] Tambahkan reversal batch posted, worker posting AR/AP/STOCK/closing, cutover gate, dan year-end close.

### Fondasi accounting core (2026-10-22)

- [x] `postSystemJournal` multi-line, `ruleId = null`, allowlist `OPENING_BALANCE`/`YEAR_END_CLOSE` dan source type.
- [x] Validasi branch/company, akun aktif, account scope, debit=kredit, nilai non-negatif, serta period/close-control.
- [x] Payload hash, replay idempotent, dan penolakan key sama dengan payload berbeda.
- [x] `postReversal` membalik debit/kredit, menandai event/posting asal, membatasi event sistem, dan menolak periode tertutup.
- [x] Runtime test `tests/w3-opening-year-end-foundation-runtime.test.mjs` 5/5 PASS.

### Schema/migration opening (2026-10-22)

- [x] Enam model opening dan empat enum ada field-for-field di tiga Prisma schema.
- [x] Migration expand-only terdaftar di `config/expand-migration-order.json`; tidak ada backfill otomatis.
- [x] Partial unique `YearEndCloseRun_posted_scope_key` masuk migration dan baseline PostgreSQL melalui post-migration SQL.
- [x] Static test `tests/w3-opening-year-end-foundation.test.mjs` 5/5 PASS.
- [x] Schema parity 4/4 PASS; baseline PostgreSQL 6/6 PASS; `prisma validate` SQLite/PostgreSQL PASS.
- [x] SQLite migration rehearsal dan `db:local:prepare` PASS.
- [ ] PostgreSQL migration rehearsal nyata (butuh `T360_MIGRATION_DATABASE_URL`).
- [x] `quality:recorded:fast` PASS 2058/2058 (`logs/quality-fast-2026-10-22T08-38-46.640Z.log`).

### Staging dan approval opening (2026-10-22)

- [x] Endpoint list/detail/rows/preview/create/revalidate/submit/approve/cancel dengan pagination, tenant/branch scope, audit, dan idempotency.
- [x] CSV parser canonical dan penolakan XLSX/binary/sumber ambigu; limit row dan error truncation.
- [x] Validasi STOCK/AR/AP/GL, termasuk pajak AR/AP, control account, outstanding, duplikat dokumen, dan keseimbangan GL.
- [x] Feature flag dicek pada write; dry-run tetap tersedia saat flag OFF; precedence branch > company > global.
- [x] Permission `accounting.opening.view/import/approve` terdaftar di seed dan diberikan ke role finance terkait.
- [x] Maker-checker approval dan cancel sebelum `APPROVED`; revalidate memakai CAS `status + updatedAt`.
- [x] Idempotency replay `(companyId, operationKey)` + checksum dicek sebelum validasi referensi.
- [x] Runtime test `tests/w3-opening-balance-staging-runtime.test.mjs` 13/13 PASS.
- [x] `npm run lint --workspaces --if-present` dan `npx tsc --noEmit -p apps/api/tsconfig.json` PASS.
- [ ] HTTP guard/permission runtime test dan concurrency dua approver/posting.
- [x] Posting opening GL: `POST batches/:id/post`, permission `accounting.opening.post`, transisi atomik `APPROVED → POSTING → POSTED`, `postSystemJournal` dengan key `opening-gl:<batchId>`, hanya akun neraca, dan replay idempotent.
- [ ] Posting opening AR/AP/STOCK, reversal batch posted, settlement, cutover gate, dan year-end close.

## Verification

- [ ] Opening stock: qty dan nilai per gudang/batch tie-out ke cost layer dan inventory movement; negatif/duplikat ditolak.
- [ ] Opening AR/AP: subledger = control account, aging awal = saldo, pajak dan pembayaran terhubung ke invoice.
- [ ] Trial balance debit=kredit setelah opening; akun suspense dan selisih harus terlihat dan tidak boleh diabaikan.
- [x] Posting GL menghasilkan satu jurnal sistem seimbang, baris `POSTED`, audit, dan replay tanpa duplikasi event/jurnal.
- [ ] Closing entries: laba ditahan, snapshot opening tahun berikut (bukan jurnal duplikat), period lock, dan reversal diuji dengan data sintetis.
- [ ] Settlement opening AR/AP via customer receipt/supplier payment: outstanding berkurang, jurnal seimbang, dan tidak membuat pajak baru.
- [ ] Cutover gate: batch gagal/POSTING memblokir operasi; GL residual tidak menggandakan inventory/AR/AP control.
- [ ] Idempotency/retry: import dan closing dijalankan ulang tanpa menggandakan saldo atau jurnal.
- [x] Idempotency staging: replay operation key mengembalikan batch sama dan payload berbeda ditolak.
- [ ] Concurrency/maker-checker: dua operator tidak dapat menyetujui import/closing yang sama; approval dan audit tercatat.
- [x] Maker-checker staging: creator tidak dapat approve batch sendiri; approver berbeda dapat memindahkan ke `APPROVED`.
- [ ] Tenant/branch/warehouse isolation dan permission test untuk import, posting, closing, dan reversal.
- [x] Tenant/branch isolation staging: pagination hanya mengembalikan batch company/branch token.
- [ ] Performance test import batch dan laporan rekonsiliasi pada volume data besar; query plan dan index terukur.
- [ ] Migration rehearsal PostgreSQL nyata dan rollback/restore drill (SQLite rehearsal dan baseline PostgreSQL sudah PASS).
- [x] Jalankan quality gate cepat: `npm run quality:recorded:fast` PASS 2058/2058.
- [ ] Jalankan `npm run quality:full` sebelum release.
- [x] Catat evidence dan known issues pada work item/handoff.

## Release

- [ ] UAT atau staging selesai.
- [ ] Rollback plan telah diuji atau direview.
- [ ] Monitoring aktif.
- [ ] Work item dipindahkan ke RELEASE_READY, RELEASED, lalu CLOSED sesuai evidence.
