# Prompt Pelaksana — T360-20261021-134120

Kerjakan work item Toko360 berikut pada repository ini. Jangan membangun ulang modul yang sudah ada dan jangan mengubah alur stabil tanpa bukti.

## Identitas
- ID: T360-20261021-134120
- Judul: Costing engine dan valuasi persediaan
- Modul: inventory
- Wave: W1
- Risk: CRITICAL
- Work item file: work-items/active/T360-20261021-134120-costing-engine-dan-valuasi-persediaan.json

## Design (ACCEPTED)

- ADR: `docs/adr/ADR-T360-20261021-134120-COSTING-METHOD.md` (status ACCEPTED 2026-10-21; implementasi boleh dimulai).
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

- Schema cost layer, kebijakan metode, dan relasi ke inventory movement tersedia di tiga dialek Prisma; migration expand-only dan baseline PostgreSQL diperbarui.
- Penjualan, retur penjualan, dan reversal mengonsumsi layer secara atomik; COGS yang diposting sama dengan nilai layer yang dikonsumsi.
- FIFO, LIFO, dan average memiliki perhitungan yang teruji; metode default dan konfigurasi per scope tercatat di ADR.
- Stok negatif, layer kosong, dan konsumsi bersamaan ditolak atau diserialisasi tanpa menggandakan COGS; retry idempotent.
- Penerimaan backdated, periode terkunci, retur, dan rebuild layer menghasilkan saldo yang dapat direkonsiliasi tanpa mengedit data historis.
- Laporan valuasi, margin, dan HPP memakai layer; selisih terhadap metode lama diukur dalam parallel run dan disetujui sebelum cutover.
- Feature flag inventory.costing dapat mematikan jalur baru; jalur lama tetap menghasilkan transaksi yang valid tanpa kehilangan data layer.
- Test unit/integration/concurrency/security/performance lulus, termasuk tenant isolation, permission, query plan, dan migration rehearsal SQLite/PostgreSQL.
- Dokumentasi ADR, runbook backfill/rebuild, rollback, monitoring, dan known limitation tersedia; tidak ada klaim production-ready sebelum STAGING dan Human Stage-20.

## Test plan

- Unit test perhitungan FIFO, LIFO, average, pembulatan, dan konsumsi layer parsial.
- Integration test penerimaan, penjualan, retur, reversal, dan penyesuaian; pastikan jurnal HPP debit=kredit dan nilai layer sama dengan COGS.
- Concurrency test dua penjualan terakhir pada layer yang sama; hanya satu yang boleh berhasil atau keduanya diserialisasi tanpa COGS ganda.
- Negative stock dan layer kosong harus menolak transaksi secara atomik; tidak ada movement/jurnal parsial.
- Backdated receipt dan period lock: receipt tanpa event setelahnya boleh dalam periode terbuka; receipt dengan event setelahnya ditolak dan koreksi memakai rebuild/approval dengan jurnal kompensasi; periode terkunci menolak posting.
- Idempotency/replay test untuk posting, retry, rebuild, dan import layer; operation key yang sama tidak menggandakan data.
- Rebuild/reconciliation test: total layer = nilai persediaan = saldo akun persediaan; selisih harus nol atau dijelaskan.
- Tenant/branch/warehouse isolation dan permission test untuk endpoint kebijakan, rebuild, dan koreksi; audit event tercatat.
- Performance test query valuation/COGS pada volume movement besar dengan query plan dan index yang terukur.
- Migration rehearsal SQLite dan PostgreSQL, termasuk `npm run db:baseline:postgres` dan `db:baseline:postgres:check`.

Berikan hasil berupa perubahan source code, migration aman bila diperlukan, test, dokumentasi, dan ringkasan evidence.
