ALTER TABLE "PurchaseRequestItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN "productUnitId" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN "unitCode" TEXT;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN "unitQuantity" INTEGER;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN "quantityFactor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PurchaseRequestItem" ADD COLUMN "sourceBarcode" TEXT;