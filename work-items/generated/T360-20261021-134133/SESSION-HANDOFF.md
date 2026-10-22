# Session Handoff — T360-20261021-134133

- Checkpoint baseline: `RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF`
- Work item: `work-items/active/T360-20261021-134133-saldo-awal-dan-tutup-tahun.json`
- Branch: `feature/t360-20261021-134133-saldo-awal-dan-tutup-tahun`
- Phase: `DESIGN`
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
- Generated `TASK.md`, `AI-PROMPT.md`, dan checklist disinkronkan ke ACCEPTED.
- Work item tetap **DESIGN** karena implementasi bergantung pada fondasi costing.

## Belum dikerjakan

- Implementation, migration, test, dan staging.
- Enforcement feature flag `accounting.opening_and_year_end`.
- Perluasan `CUSTOMER_RECEIPT`/`SUPPLIER_PAYMENT` untuk `OpeningLedgerDocument`.
- Integrasi saldo awal stok dengan costing/backfill yang sedang dibangun.
- Cutover gate, year-end close, report filter, dan rollback drill.

## Hasil quality gate

- `node scripts/workflow.mjs validate`: PASS 73 work item / 8 delivery wave.
- `npm run validate:repo`: PASS 1311 files / 208 Prisma models.
- `npm run quality:fast`: PASS 2024/2024 test, lint, `db:local:prepare`,
  dan worker build.
- `git diff --check`: dijalankan setelah pembaruan handoff.

## Known issues

- Implementasi opening belum dimulai; semua perubahan opening saat ini
  dokumentasi/design.
- `postManual` belum membandingkan payload; terkait audit jurnal.
- `postSystemJournal` belum ada; `AccountingPosting.ruleId=null` perlu diuji
  terhadap report.
- Payroll adjustment masih membuat jurnal langsung; perlu work item terpisah
  atau dinyatakan di luar cutover.
- Aging AR/AP masih dibatasi 500 baris; harus diselesaikan sebelum opening
  produksi.
- Saldo awal stok bergantung pada costing engine yang masih IMPLEMENTATION;
  seluruh writer utama sudah tercakup, tetapi rebuild/backfill/rekonsiliasi
  dan bukti VERIFICATION belum selesai.

## Langkah aman berikutnya

1. Tunggu rebuild/backfill/rekonsiliasi costing dan bukti VERIFICATION selesai;
   seluruh writer stok utama sudah terintegrasi.
2. Setelah itu masuk IMPLEMENTATION bertahap: schema/staging -> journal API ->
   opening stock/AR/AP/GL -> cutover gate -> year-end -> report/filters.
3. Uji pada database TEST dan siapkan rollback sebelum staging.
