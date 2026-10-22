# Implementation Checklist — T360-20261021-134120

## Analysis

- [x] Baca work item dan seluruh dokumen sumber.
- [x] Audit implementasi yang sudah ada; jangan membuat modul duplikat.
- [x] Tetapkan system of record, state machine, invariant, dan failure modes.
- [x] Konfirmasi dampak database, inventory, accounting, tax, payment, payroll, sync, security, dan performance.

## Design

- [x] Tetapkan API/DTO/event contract (lihat ADR costing).
- [x] Tetapkan permission dan tenant/branch scope.
- [x] Tetapkan idempotency key serta retry behavior.
- [x] Tetapkan migration, index, pagination, retention, dan rollback.
- [x] Tetapkan accounting/tax posting rule bila relevan.
- [x] User/owner menyetujui ADR sebelum IMPLEMENTATION (2026-10-21).

## Implementation

- [x] Implementasi kecil dan modular.
- [x] Hindari jurnal, pajak, stok, atau notification logic tersebar di modul.
- [x] Tambahkan audit event dan structured error.
- [x] Perbarui dokumentasi dan feature flag.
- [x] Integrasi writer receipt, sale, order, retur penjualan/order, purchase return, transfer, opname, produksi, dan maintenance (2026-10-21).
- [x] API policy costing (DRAFT/activate), guard maker-checker, permission, audit, dan valuasi read-only (2026-10-22).
- [x] Layer explorer dan rekonsiliasi state vs Inventory/layer OPEN read-only (2026-10-22).

## Verification

- [ ] Unit test perhitungan FIFO, LIFO, average, pembulatan, dan konsumsi layer parsial.
- [ ] Integration test penerimaan, penjualan, retur, reversal, dan penyesuaian; pastikan jurnal HPP debit=kredit dan nilai layer sama dengan COGS.
- [ ] Concurrency test dua penjualan terakhir pada layer yang sama; hanya satu yang boleh berhasil atau keduanya diserialisasi tanpa COGS ganda.
- [ ] Negative stock dan layer kosong harus menolak transaksi secara atomik; tidak ada movement/jurnal parsial.
- [ ] Backdated receipt: periode terbuka tanpa event setelahnya boleh; jika ada event setelahnya ditolak dan koreksi memakai rebuild/approval dengan jurnal kompensasi. Periode terkunci menolak posting.
- [ ] Idempotency/replay test untuk posting, retry, rebuild, dan import layer; operation key yang sama tidak menggandakan data.
- [ ] Rebuild/reconciliation test: total layer = nilai persediaan = saldo akun persediaan; selisih harus nol atau dijelaskan.
- [ ] Tenant/branch/warehouse isolation dan permission test untuk endpoint kebijakan, rebuild, dan koreksi; audit event tercatat.
- [ ] Performance test query valuation/COGS pada volume movement besar dengan query plan dan index yang terukur.
- [ ] Migration rehearsal SQLite dan PostgreSQL, termasuk `npm run db:baseline:postgres` dan `db:baseline:postgres:check`.
- [x] Jalankan `npm run quality:fast`.
- [ ] Jalankan `npm run quality:full` sebelum release.
- [x] Catat evidence dan known issues pada work item/handoff.

## Release

- [ ] UAT atau staging selesai.
- [ ] Rollback plan telah diuji atau direview.
- [ ] Monitoring aktif.
- [ ] Work item dipindahkan ke RELEASE_READY, RELEASED, lalu CLOSED sesuai evidence.
