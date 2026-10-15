-- Expand-only: a nullable presentation column. No existing row is read, rewritten or backfilled.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
