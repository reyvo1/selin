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
- [x] Backfill snapshot + `CostingRebuildRun` + endpoint rebuild/rebuild-runs + maker-checker/audit (2026-10-22).
- [x] Rekonsiliasi saldo akun inventory `1301` per branch + `valueDifferenceVsGl` (2026-10-22).
- [x] Runtime test backfill non-batch/batch, replay operation key, maker-checker, tenant isolation, flag/state guard (2026-10-22).
- [x] Engine FIFO/LIFO: layer order, consumption, preview, state aggregate, report/valuation method-aware (2026-10-22).
- [x] Backfill FIFO/LIFO membuat `OPENING` event + layer, bukan hanya state (2026-10-22).
- [x] Atribusi purchase return FIFO/LIFO memprioritaskan layer receipt asal dari `goodsReceiptItemId`, dengan fallback FIFO/LIFO bila layer asal habis/tidak tersedia (2026-10-22).
- [ ] UI pemilihan metode; LIFO menunggu finance/tax.

## Verification

- [x] Unit test perhitungan FIFO, LIFO, average, pembulatan, dan konsumsi layer parsial (runtime SQLite 2026-10-22).
- [ ] Integration test penerimaan, penjualan, retur, reversal, dan penyesuaian; pastikan jurnal HPP debit=kredit dan nilai layer sama dengan COGS.
  - [x] Runtime SQLite penjualan, pesanan, retur penjualan/order, retur pembelian (termasuk layer asal), transfer, opname, produksi, dan maintenance dengan jurnal HPP seimbang (2026-10-22).
- [x] Concurrency test dua penjualan terakhir pada layer yang sama; hanya satu yang boleh berhasil atau keduanya diserialisasi tanpa COGS ganda (runtime SQLite 2026-10-22).
- [x] Negative stock dan layer kosong menolak transaksi secara atomik; sale/stock/batch tidak berubah saat ACTIVE menolak issue tanpa biaya (runtime SQLite 2026-10-22).
- [ ] Backdated receipt: periode terbuka tanpa event setelahnya boleh; jika ada event setelahnya ditolak dan koreksi memakai rebuild/approval dengan jurnal kompensasi. Periode terkunci menolak posting.
  - [x] Receipt backdated dengan event setelahnya ditolak tanpa mengubah state, layer, atau event (runtime SQLite 2026-10-22).
  - [x] Periode fiskal tertutup menolak sale sebelum stock, jurnal, atau event costing berubah (runtime SQLite 2026-10-22).
  - [x] Accounting close control `CLOSED` menolak sale sebelum stock, jurnal, atau event costing berubah (runtime SQLite 2026-10-22).
- [x] Idempotency/replay test untuk posting, retry, rebuild, dan import layer; operation key yang sama tidak menggandakan data.
  - [x] Rebuild backfill operation key replay mengembalikan run yang sama.
  - [x] Receipt dan ISSUE replay mengembalikan event yang sama tanpa layer/consumption ganda (runtime SQLite 2026-10-22).
- [ ] Rebuild/reconciliation test: total layer = nilai persediaan = saldo akun persediaan; selisih harus nol atau dijelaskan.
  - [x] Rekonsiliasi state vs Inventory vs `1301` diekspos; selisih backfill vs GL terlihat, tetapi jurnal opening/aktivasi belum diuji.
- [x] Tenant/branch/warehouse isolation dan permission test untuk endpoint kebijakan, rebuild, dan koreksi; audit event tercatat (policy/report scoped, cross-branch rebuild ditolak, audit request/completed diverifikasi pada SQLite 2026-10-22).
- [x] Performance test query valuation/COGS pada volume movement besar dengan query plan dan index yang terukur (2.000 layer, `EXPLAIN QUERY PLAN` memakai index, issue 500 unit <5 detik pada SQLite 2026-10-22).
- [ ] Migration rehearsal SQLite dan PostgreSQL, termasuk `npm run db:baseline:postgres` dan `db:baseline:postgres:check`.
- [x] Jalankan `npm run quality:fast`.
- [ ] Jalankan `npm run quality:full` sebelum release.
- [x] Catat evidence dan known issues pada work item/handoff.

## Release

- [ ] UAT atau staging selesai.
- [ ] Rollback plan telah diuji atau direview.
- [ ] Monitoring aktif.
- [ ] Work item dipindahkan ke RELEASE_READY, RELEASED, lalu CLOSED sesuai evidence.
