# T360-20261021-134133 — Saldo awal dan tutup tahun

Menambahkan fondasi skema expand-only untuk batch saldo awal, baris staging,
dokumen opening AR/AP, settlement opening, dan tutup tahun.

## Expand-only

Semua tabel baru dan tidak ada kolom lama yang diubah atau dihapus:

- `OpeningBalanceBatch`
- `OpeningBalanceRow`
- `OpeningLedgerDocument`
- `OpeningLedgerSettlement`
- `YearEndCloseRun`
- `YearEndCloseLine`

Migration tidak membuat jurnal, tidak mengubah saldo, dan tidak membackfill
data operasional. Posting saldo awal/tutup tahun harus lewat service dan
accounting core setelah permission, feature flag, dry-run, serta approval
maker-checker tersedia.

## Backfill plan

1. Tidak ada backfill otomatis pada migration ini.
2. Batch saldo awal diunggah dan divalidasi per batch/row di staging.
3. Setelah reconcilasi dan approval, posting dijalankan oleh service dengan
   operation key per batch.
4. Tutup tahun dihitung ulang dari ledger saat preview dan posting, bukan dari
   snapshot lama.

## Index/query impact

- Batch unik per `(companyId, operationKey)`; pencarian memakai scope
  company/branch/type/cutover atau status.
- Row unik per `(batchId, rowNumber)` dengan index status dan dokumen sumber.
- Dokumen AR/AP unik per `(companyId, branchId, kind, documentNumber)` dan
  diindeks untuk aging per customer/supplier serta due date.
- Settlement unik per `(companyId, branchId, operationKey)` dan per dokumen +
  transaksi finance.
- Run tutup tahun unik per `(companyId, branchId, fiscalYear, operationKey)`;
  partial unique index memastikan maksimal satu run `POSTED` per scope/tahun.
- Line tutup tahun diindeks per run/lineType dan accountCode.

## Rollback

Deploy aplikasi versi sebelumnya dan biarkan tabel tetap ada. Jangan drop
tabel pada rollback insiden. Matikan flag `accounting.opening_and_year_end`,
hentikan batch/run, dan balik posting yang sudah ada dengan reversal atau
compensating operation. Restore snapshot hanya bila prosedur insiden
mengharuskannya.

## Verifikasi

- `npm run db:migrations:rehearse:sqlite`
- `npm run db:migrations:rehearse:postgres`
- `node --test tests/prisma-schema-field-parity.test.mjs`
- Test service untuk idempotency, tenant/branch isolation, period lock,
  maker-checker, dan partial unique `POSTED`.
