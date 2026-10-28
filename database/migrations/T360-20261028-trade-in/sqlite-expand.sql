-- Expand-only: trade-in foundation. No existing table is rewritten.
CREATE TABLE IF NOT EXISTS "TradeIn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "originalProductId" TEXT NOT NULL,
  "newProductId" TEXT,
  "tradeValue" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "TradeIn_companyId_branchId_status_idx"
  ON "TradeIn"("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "TradeIn_originalProductId_idx"
  ON "TradeIn"("originalProductId");
