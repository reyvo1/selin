-- Expand-only: nullable warehouse scoping. Existing rows remain company-level defaults (NULL).
ALTER TABLE "TaxCode" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE "TaxRule" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
