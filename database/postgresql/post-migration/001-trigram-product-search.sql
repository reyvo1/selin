-- Pencarian nama produk pada skala besar memakai trigram PostgreSQL.
-- Lihat docs/LARGE-SCALE-DATA.md §5: barcode/SKU exact -> SKU prefix -> nama trigram.
-- File ini hanya untuk PostgreSQL; SQLite development tetap memakai LIKE.
-- Baseline/release baru: jalankan apa adanya (index dibuat saat tabel kosong).
-- Deployment yang tabelnya sudah besar: jalankan CREATE INDEX ... CONCURRENTLY
-- di luar transaksi, lalu catat di runbook migration.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductVariant_name_trgm_idx"
  ON "ProductVariant" USING gin ("name" gin_trgm_ops);
