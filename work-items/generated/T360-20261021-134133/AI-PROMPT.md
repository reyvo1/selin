# Prompt Pelaksana — T360-20261021-134133

Kerjakan work item Toko360 berikut pada repository ini. Jangan membangun ulang modul yang sudah ada dan jangan mengubah alur stabil tanpa bukti.

## Identitas
- ID: T360-20261021-134133
- Judul: Saldo awal dan tutup tahun
- Modul: accounting-core
- Wave: W3
- Risk: CRITICAL
- Work item file: work-items/active/T360-20261021-134133-saldo-awal-dan-tutup-tahun.json

## Design (ACCEPTED)

- ADR: `docs/adr/ADR-T360-20261021-134133-OPENING-BALANCE-CUTOVER.md` (status ACCEPTED 2026-10-21; implementasi menunggu fondasi costing).
- Baca ADR sebelum mengubah schema atau service; keputusan varian, idempotency, dan cutover ada di sana.

## Instruksi wajib
1. Baca docs/DEVELOPMENT-KIT.md, docs/DEVELOPMENT-WORKFLOW.md, work item, dan dokumen sumbernya.
2. Audit source yang ada sebelum mengedit.
3. Kerjakan hanya scope work item dan pertahankan kompatibilitas.
4. Semua data harus company/branch scoped.
5. Semua mutasi yang dapat diulang harus idempotent.
6. Stok hanya berubah melalui inventory movement; jurnal melalui accounting core; pajak melalui tax core.
7. Tambahkan permission, audit, validation, pagination/index bila relevan.
8. Tambahkan test sesuai test plan dan jalankan quality gate.
9. Perbarui work item dengan evidence, perubahan, known issues, dan rollback.
10. Jangan memakai database production, credential, atau data pelanggan nyata.

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

Berikan hasil berupa perubahan source code, migration aman bila diperlukan, test, dokumentasi, dan ringkasan evidence.
