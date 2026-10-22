# T360-20261021-134120 — Costing engine dan valuasi persediaan

Menambahkan fondasi skema untuk costing engine: policy berversi, state moving
average, event biaya append-only, layer/consumption FIFO/LIFO, run rebuild,
dan `InventoryMovement.occurredAt`.

## Expand-only

Semua tabel baru dan kolom baru bersifat additive. Tidak ada kolom lama yang
diubah atau dihapus. `InventoryMovement.occurredAt` ditambahkan nullable dan di-backfill dari
`createdAt` tanpa default database; writer wajib mengisi `occurredAt` eksplisit.
Baris lama tidak dihitung ulang dan tidak membentuk cost event pada migration
ini.

## Backfill plan

1. Migration hanya mengisi `occurredAt` dari `createdAt`.
2. Backfill costing dijalankan terpisah oleh `CostingRebuildRun` dalam mode
   `SHADOW`, per company/branch/warehouse, setelah policy aktif.
3. Hasil rebuild direkonsiliasi dengan `Inventory`, layer/state, dan jurnal
   sebelum aktivasi `inventory.costing`.
4. Tidak ada backfill costing pada migration SQL; production tidak boleh
   menjalankan perhitungan berat saat deploy.
5. Migration menambahkan akun `4203`/`5103` dan rule `PURCHASE-RETURN` versi 2
   (`inventory` amount key) untuk company/branch existing secara idempotent.
   Verifikasi rule aktif sebelum mengaktifkan writer retur supplier.

## Index/query impact

- `InventoryCostState` unik per company/branch/warehouse/product/batch/method.
- `InventoryCostEvent` unik per `(companyId, operationKey)` dan per source line
  + event type; index scope+occurredAt untuk replay/backfill.
- `InventoryCostLayer` unik per receipt event; index FIFO/LIFO berdasarkan
  scope, status, dan `receivedAt`.
- `InventoryMovement` mendapat index `(warehouseId, productId, occurredAt)` dan
  `(occurredAt, id)`; index `createdAt` lama tetap dipertahankan.

## Rollback

Deploy aplikasi versi sebelumnya dan biarkan tabel/kolom tetap ada. Jangan drop
tabel atau kolom saat rollback insiden. Cost event append-only tidak boleh
dihapus; reversal dilakukan lewat event pembalik. Bila aktivasi harus
dibatalkan, set policy kembali ke `SHADOW` dan hentikan writer costing.

## Verifikasi

- `npm run db:migrations:rehearse:sqlite`
- `npm run db:migrations:rehearse:postgres`
- `tests/prisma-schema-field-parity.test.mjs`
- Test idempotency, concurrency state CAS, branch isolation, backdated receipt,
  dan reconciliation layer/state/journal.
