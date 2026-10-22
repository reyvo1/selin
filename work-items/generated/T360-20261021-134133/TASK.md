# T360-20261021-134133 — Saldo awal dan tutup tahun

## Mulai dari sini

- Work item: `work-items/active/T360-20261021-134133-saldo-awal-dan-tutup-tahun.json`
- Modul: `accounting-core`
- Wave: `W3 — Accounting and tax core`
- Risiko: `CRITICAL`
- Fase awal: `DESIGN`
- Branch yang disarankan: `feature/t360-20261021-134133-saldo-awal-dan-tutup-tahun`
- Feature flag: `accounting.opening_and_year_end`

## Tujuan

Saldo awal dan tutup tahun. Pekerjaan harus mengikuti Development Kit, workflow, tenant isolation, permission, idempotency, audit, serta quality gate repository.

## Design output (ACCEPTED)

- ADR: `docs/adr/ADR-T360-20261021-134133-OPENING-BALANCE-CUTOVER.md` (status ACCEPTED 2026-10-21; implementasi menunggu fondasi costing).
- Model minimum: `OpeningBalanceBatch`, `OpeningBalanceRow`, `OpeningLedgerDocument`, `OpeningLedgerSettlement`, `YearEndCloseRun`, `YearEndCloseLine`.
- Accounting core mendapat `postSystemJournal` (multi-line, `ruleId = null`) dan `postReversal` (`reversalOfId`, `reversedAt`), tetap menghormati period lock dan idempotency.
- Opening GL wajib debit=kredit dan hanya balance-sheet; opening stock tie-out ke costing; opening AR/AP tie-out ke control account dan aging per invoice.
- Tutup tahun: preview worksheet -> validasi -> approval maker-checker -> auto-post closing -> soft/final close. Opening tahun berikut tidak membuat jurnal duplikat.
- P&L/balance sheet mengecualikan event `YEAR_END_CLOSE` dari current earnings; trial balance tetap memuat closing entries.
- Flag `accounting.opening_and_year_end` dicek server-side; permission import/approve/post/reverse terpisah.
- Payroll adjustment bypass di luar scope tetapi harus diselesaikan sebelum klaim tutup tahun production-ready.

### Urutan implementasi

1. `postSystemJournal` + `postReversal` + permission + flag enforcement.
2. Batch/row staging, upload CSV/Excel, validasi, dry-run, approval, checkpoint.
3. Opening GL dan rekonsiliasi trial balance.
4. Opening stock terintegrasi costing dan inventory movement append-only.
5. Opening AR/AP, settlement, aging per invoice, dan subledger tie-out.
6. Year-end preview/approval/posting/period lock/reversal + filter report.
7. Reconciliation report, performance, migration rehearsal, staging/UAT.

### Belum boleh mulai implementasi sampai

- [ ] User/owner menyetujui ADR opening/closing.
- [ ] ADR costing disetujui karena opening stock bergantung padanya.
- [ ] Payroll adjustment bypass diselesaikan atau dinyatakan di luar cutover.

## Aturan bisnis

- Saldo awal stok diimpor per gudang/batch dari snapshot yang disetujui; qty dan nilai harus tie-out ke opening cost layer, inventory movement append-only, serta location/condition balance.
- Saldo awal AR/AP diimpor per invoice dengan customer/supplier yang company-nya cocok, tanggal, jatuh tempo per invoice, pajak, dan pembayaran; subledger wajib sama dengan control account.
- Saldo awal diimpor sebagai batch CSV/Excel (Excel memakai parser yang disetujui) dengan dry-run, validasi, approval maker-checker, dan koreksi manual terbatas; koreksi setelah posting hanya lewat reversal/compensating.
- Tutup tahun memakai preview worksheet yang dapat diperiksa, approval maker-checker, lalu auto-post closing entries ke laba ditahan; opening tahun berikut adalah snapshot saldo akhir, bukan jurnal duplikat.
- Saldo awal GL wajib seimbang debit=kredit; jurnal manual tanpa dokumen sumber masuk suspense dan memerlukan approval, bukan diposting sebagai saldo final.
- Tutup tahun membuat closing entries ke laba ditahan, snapshot opening tahun berikutnya (bukan jurnal duplikat), dan period lock; reversal memakai dokumen pembalik, bukan edit jurnal.
- Semua import dan posting memakai operation key unik dan idempotent; rerun tidak boleh menggandakan saldo, jurnal, atau pembayaran.
- Saldo awal pajak memakai tax core berversi dan tanggal efektif; opening AR/AP tidak membuat TaxTransaction baru agar pajak historis tidak dihitung dua kali, dan tarif tidak diubah in-place.
- Settlement opening AR/AP memakai OperationalFinanceTransaction dengan referenceType OpeningLedgerDocument; tidak membuat Sale/GoodsReceipt sintetis, dan outstanding diperbarui atomik.
- Tidak ada data produksi yang dipakai sebagai data test; dry-run dan rekonsiliasi dilakukan di staging/synthetic dataset.
- Feature flag accounting.opening_and_year_end harus dapat dimatikan tanpa rollback schema; data yang sudah diposting tidak dihapus, hanya dibalik dengan compensating operation.
- Batch opening yang masih POSTING harus memblokir tutup tahun dan ditandai in-progress pada report; file mentah disimpan di private storage dengan retensi, bukan di log atau payload baris.
- Cutover gate wajib lulus sebelum operasi normal: semua batch opening POSTED, trial balance seimbang, subledger AR/AP = control, inventory = cost layer, dan tidak ada row gagal; GL batch hanya akun residual.
- Opening AR/AP memposting outstanding (total - paid pra-cutover), bukan total invoice; pembayaran setelah cutover memakai OperationalFinanceTransaction dan memperbarui settledAmount/outstanding secara atomik.

## Acceptance criteria

- Import saldo awal stok, AR/AP, dan GL tersedia dengan validasi, dry-run, batch, checkpoint, dan laporan selisih.
- Import saldo awal mendukung CSV/Excel, dry-run, approval maker-checker, dan koreksi manual terbatas; hasil posting dapat direkonsiliasi.
- Saldo awal stok tie-out ke opening cost layer dan inventory movement; tidak ada qty/nilai yang muncul tanpa dokumen sumber.
- Saldo awal AR/AP tie-out ke control account dan aging; invoice, pajak, pembayaran, dan due date dapat direkonsiliasi.
- Trial balance seimbang setelah opening; jurnal tidak seimbang, akun salah scope, atau periode terkunci ditolak.
- Tutup tahun menghasilkan closing entries, laba ditahan, snapshot opening tahun berikut, period lock, dan reversal yang dapat diuji.
- Rerun import/closing idempotent; tidak ada saldo/jurnal ganda; kegagalan parsial dapat dilanjutkan atau dibalik.
- Feature flag dan rollback tersedia; data yang sudah diposting hanya dibalik dengan reversal/compensating.
- Test unit/integration/concurrency/security/performance dan migration rehearsal SQLite/PostgreSQL lulus; baseline PostgreSQL diperbarui.
- Dokumentasi ADR, runbook opening/closing, rekonsiliasi, rollback, dan monitoring tersedia; tidak ada klaim production-ready sebelum STAGING dan Human Stage-20.
- Settlement opening AR/AP terhubung ke OperationalFinanceTransaction dan outstanding-nya tie-out setelah pembayaran; tidak ada TaxTransaction ganda.
- Cutover gate dan rekonsiliasi opening lulus sebelum operasi normal; tidak ada double posting inventory/AR/AP control di GL.

## Test plan

- Opening stock: qty dan nilai per gudang/batch tie-out ke cost layer dan inventory movement; negatif/duplikat ditolak.
- Opening AR/AP: subledger = control account, aging awal = saldo, pajak dan pembayaran terhubung ke invoice.
- Trial balance debit=kredit setelah opening; akun suspense dan selisih harus terlihat dan tidak boleh diabaikan.
- Closing entries: laba ditahan, snapshot opening tahun berikut, period lock, dan reversal diuji dengan data sintetis.
- Idempotency/retry: import dan closing dijalankan ulang tanpa menggandakan saldo atau jurnal.
- Concurrency/maker-checker: dua operator tidak dapat menyetujui import/closing yang sama; approval dan audit tercatat.
- Tenant/branch/warehouse isolation dan permission test untuk import, posting, closing, dan reversal.
- Performance test import batch dan laporan rekonsiliasi pada volume data besar; query plan dan index terukur.
- Migration rehearsal SQLite/PostgreSQL dan `npm run db:baseline:postgres`; rollback/restore drill.
- Settlement opening AR/AP via customer receipt/supplier payment: outstanding berkurang, jurnal seimbang, dan tidak membuat pajak baru.
- Cutover gate: batch gagal/POSTING memblokir operasi; GL residual tidak menggandakan inventory/AR/AP control.

## Dampak lintas modul

| Domain | Dampak |
|---|---|
| database | HIGH |
| inventory | HIGH |
| accounting | HIGH |
| tax | HIGH |
| payment | MEDIUM |
| payroll | NONE |
| sync | NONE |
| security | HIGH |
| performance | MEDIUM |

## Migration plan

Tambah tabel staging/import, status batch, dan referensi dokumen sumber secara expand-only. Tidak ada backfill otomatis ke saldo final; import berjalan dry-run, validasi, approval, lalu posting batch. Cutover memakai freeze dan snapshot; regenerate baseline PostgreSQL; uji restore dan rerun. Data historis yang tidak lengkap masuk suspense, bukan direkayasa.

## Rollback plan

Matikan feature flag accounting.opening_and_year_end, hentikan import/closing, simpan checkpoint, dan restore snapshot bila perlu. Posting yang sudah ada dibalik dengan reversal/compensating; tidak ada edit atau hapus jurnal langsung. Rekonsiliasi ulang trial balance, subledger, dan stok sebelum aktivasi kembali; catat rollback di work item.

## Monitoring plan

Pantau status batch import, jumlah baris valid/ditolak, saldo suspense, selisih trial balance, selisih subledger vs control account, status closing, dan antrean job. Alert bila saldo tidak seimbang, batch gagal berulang, atau closing tertahan; observasi sampai satu siklus tutup buku.

## Security notes

Import, closing, dan reversal memakai permission finance sempit, tenant/branch/warehouse scope dari AuthUser, maker-checker, audit event, dan rate limit. File import tidak boleh memuat credential atau data kartu; data pribadi disensor di log. Operation key dan bukti approval disimpan tanpa secret.

## File yang kemungkinan relevan

- `apps/api/src/accounting-core`
- `apps/api/src/accounting-core/accounting-core.controller.ts`
- `apps/api/src/accounting-core/accounting-core.module.ts`
- `apps/api/src/accounting-core/accounting-core.service.ts`
- `apps/api/src/accounting-core/dto`

## Dokumen sumber

- `docs/IPOS-5-PARITY-WORKFLOW.md`
- `docs/F4-ACCOUNTING-COMPLETION.md`
- `docs/FINANCE-ACCOUNTING-RECONCILIATION.md`
- `docs/ERD.md`
- `docs/adr/ADR-T360-20261021-134133-OPENING-BALANCE-CUTOVER.md`
- `docs/DEVELOPMENT-WORKFLOW.md`
- `handoff/CURRENT-WORK.md`
