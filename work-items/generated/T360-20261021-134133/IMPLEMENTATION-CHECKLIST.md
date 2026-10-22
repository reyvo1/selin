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

- [ ] Implementasi kecil dan modular.
- [ ] Hindari jurnal, pajak, stok, atau notification logic tersebar di modul.
- [ ] Tambahkan audit event dan structured error.
- [ ] Perbarui dokumentasi dan feature flag.

## Verification

- [ ] Opening stock: qty dan nilai per gudang/batch tie-out ke cost layer dan inventory movement; negatif/duplikat ditolak.
- [ ] Opening AR/AP: subledger = control account, aging awal = saldo, pajak dan pembayaran terhubung ke invoice.
- [ ] Trial balance debit=kredit setelah opening; akun suspense dan selisih harus terlihat dan tidak boleh diabaikan.
- [ ] Closing entries: laba ditahan, snapshot opening tahun berikut (bukan jurnal duplikat), period lock, dan reversal diuji dengan data sintetis.
- [ ] Settlement opening AR/AP via customer receipt/supplier payment: outstanding berkurang, jurnal seimbang, dan tidak membuat pajak baru.
- [ ] Cutover gate: batch gagal/POSTING memblokir operasi; GL residual tidak menggandakan inventory/AR/AP control.
- [ ] Idempotency/retry: import dan closing dijalankan ulang tanpa menggandakan saldo atau jurnal.
- [ ] Concurrency/maker-checker: dua operator tidak dapat menyetujui import/closing yang sama; approval dan audit tercatat.
- [ ] Tenant/branch/warehouse isolation dan permission test untuk import, posting, closing, dan reversal.
- [ ] Performance test import batch dan laporan rekonsiliasi pada volume data besar; query plan dan index terukur.
- [ ] Migration rehearsal SQLite/PostgreSQL dan `npm run db:baseline:postgres`; rollback/restore drill.
- [ ] Jalankan `npm run quality:fast`.
- [ ] Jalankan `npm run quality:full` sebelum release.
- [ ] Catat evidence dan known issues pada work item/handoff.

## Release

- [ ] UAT atau staging selesai.
- [ ] Rollback plan telah diuji atau direview.
- [ ] Monitoring aktif.
- [ ] Work item dipindahkan ke RELEASE_READY, RELEASED, lalu CLOSED sesuai evidence.
