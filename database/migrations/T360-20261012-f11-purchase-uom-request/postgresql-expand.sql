ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "productUnitId" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "unitCode" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "unitQuantity" INTEGER;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "quantityFactor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN IF NOT EXISTS "sourceBarcode" TEXT;