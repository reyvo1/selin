-- Expand-only: nullable warehouse scoping. Existing rows remain company-level defaults (NULL).
ALTER TABLE "TaxCode" ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "TaxRule" ADD COLUMN "warehouseId" TEXT;
