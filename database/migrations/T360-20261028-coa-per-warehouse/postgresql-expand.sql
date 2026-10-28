-- Expand-only: nullable warehouse scoping. Existing rows remain branch-level defaults (NULL).
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
