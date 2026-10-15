-- Expand-only: a nullable presentation column. No existing row is read, rewritten or backfilled.
-- SQLite's ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS in the supported engine versions, which is
-- the documented engine asymmetry for this migration family.
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
