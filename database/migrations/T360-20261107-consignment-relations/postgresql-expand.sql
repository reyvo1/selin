-- Expand-only: add FK constraints for consignment relations.
CREATE TABLE IF NOT EXISTS "ConsignmentOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "supplierId" TEXT,
  "customerId" TEXT,
  "number" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ConsignmentOrder_companyId_branchId_status_idx" ON "ConsignmentOrder"("companyId","branchId","status");
CREATE TABLE IF NOT EXISTS "ConsignmentItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "consignmentOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "ownership" TEXT NOT NULL DEFAULT 'SUPPLIER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY("consignmentOrderId") REFERENCES "ConsignmentOrder"("id") ON DELETE CASCADE,
  FOREIGN KEY("productId") REFERENCES "Product"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "ConsignmentItem_consignmentOrderId_idx" ON "ConsignmentItem"("consignmentOrderId");
CREATE TABLE IF NOT EXISTS "ConsignmentSettlement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "consignmentOrderId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY("consignmentOrderId") REFERENCES "ConsignmentOrder"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ConsignmentSettlement_consignmentOrderId_idx" ON "ConsignmentSettlement"("consignmentOrderId");
