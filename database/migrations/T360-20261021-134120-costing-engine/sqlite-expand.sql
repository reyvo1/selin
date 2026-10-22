-- Expand-only: costing policy, append-only cost events, moving-average state,
-- FIFO/LIFO layers and consumption, rebuild runs, and InventoryMovement.occurredAt.
-- Existing rows are not rewritten except backfilling occurredAt from createdAt.

ALTER TABLE "InventoryMovement" ADD COLUMN "occurredAt" DATETIME;
UPDATE "InventoryMovement" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
CREATE INDEX IF NOT EXISTS "InventoryMovement_warehouseId_productId_occurredAt_idx"
  ON "InventoryMovement"("warehouseId", "productId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_occurredAt_id_idx"
  ON "InventoryMovement"("occurredAt", "id");

CREATE TABLE IF NOT EXISTS "CostingPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "scopeKey" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'SHADOW',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "effectiveFrom" DATETIME NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostingPolicy_company_scope_version_key"
  ON "CostingPolicy"("companyId", "scopeKey", "version");
CREATE INDEX IF NOT EXISTS "CostingPolicy_company_branch_status_idx"
  ON "CostingPolicy"("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "CostingPolicy_company_status_effective_idx"
  ON "CostingPolicy"("companyId", "status", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "InventoryCostState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "method" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "value" DECIMAL NOT NULL DEFAULT 0,
  "averageCost" DECIMAL NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostState_scope_key"
  ON "InventoryCostState"("companyId", "branchId", "warehouseId", "productId", "batchKey", "method");
CREATE INDEX IF NOT EXISTS "InventoryCostState_company_warehouse_product_idx"
  ON "InventoryCostState"("companyId", "warehouseId", "productId");
CREATE INDEX IF NOT EXISTS "InventoryCostState_company_branch_product_idx"
  ON "InventoryCostState"("companyId", "branchId", "productId");

CREATE TABLE IF NOT EXISTS "InventoryCostEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "movementId" TEXT,
  "eventType" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "uncostedQuantity" INTEGER NOT NULL DEFAULT 0,
  "valueDelta" DECIMAL NOT NULL,
  "unitCost" DECIMAL NOT NULL,
  "balanceQuantity" INTEGER NOT NULL,
  "balanceValue" DECIMAL NOT NULL,
  "occurredAt" DATETIME NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceLineKey" TEXT NOT NULL DEFAULT '',
  "operationKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "reversalOfId" TEXT,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostEvent_company_operation_key"
  ON "InventoryCostEvent"("companyId", "operationKey");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostEvent_source_key"
  ON "InventoryCostEvent"("companyId", "sourceType", "sourceId", "sourceLineKey", "eventType");
CREATE INDEX IF NOT EXISTS "InventoryCostEvent_scope_occurred_idx"
  ON "InventoryCostEvent"("companyId", "branchId", "warehouseId", "productId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryCostEvent_movement_idx"
  ON "InventoryCostEvent"("movementId");
CREATE INDEX IF NOT EXISTS "InventoryCostEvent_reversal_idx"
  ON "InventoryCostEvent"("reversalOfId");

CREATE TABLE IF NOT EXISTS "InventoryCostLayer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "method" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "receivedAt" DATETIME NOT NULL,
  "originalQty" INTEGER NOT NULL,
  "remainingQty" INTEGER NOT NULL,
  "unitCost" DECIMAL NOT NULL,
  "originalValue" DECIMAL NOT NULL,
  "remainingValue" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostLayer_source_event_key"
  ON "InventoryCostLayer"("sourceEventId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_fifo_scope_idx"
  ON "InventoryCostLayer"("companyId", "branchId", "warehouseId", "productId", "batchKey", "status", "receivedAt");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_method_scope_idx"
  ON "InventoryCostLayer"("companyId", "method", "status", "receivedAt");

CREATE TABLE IF NOT EXISTS "InventoryCostConsumption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "layerId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostConsumption_layer_event_key"
  ON "InventoryCostConsumption"("layerId", "eventId");
CREATE INDEX IF NOT EXISTS "InventoryCostConsumption_company_layer_idx"
  ON "InventoryCostConsumption"("companyId", "layerId");
CREATE INDEX IF NOT EXISTS "InventoryCostConsumption_event_idx"
  ON "InventoryCostConsumption"("eventId");

CREATE TABLE IF NOT EXISTS "CostingRebuildRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "method" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "fromDate" DATETIME NOT NULL,
  "toDate" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checkpoint" TEXT,
  "statistics" TEXT,
  "operationKey" TEXT NOT NULL,
  "approvedBy" TEXT,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostingRebuildRun_company_operation_key"
  ON "CostingRebuildRun"("companyId", "operationKey");
CREATE INDEX IF NOT EXISTS "CostingRebuildRun_company_branch_status_idx"
  ON "CostingRebuildRun"("companyId", "branchId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CostingRebuildRun_company_warehouse_range_idx"
  ON "CostingRebuildRun"("companyId", "warehouseId", "fromDate", "toDate");

-- Akun selisih harga beli dan rule retur supplier v2. Inventory dikreditkan
-- sebesar biaya ledger (moving average), bukan harga beli; selisihnya
-- diposting oleh aplikasi ke 4203/5103 sebagai additional journal line.
INSERT OR IGNORE INTO "Account" ("id", "branchId", "code", "name", "type")
SELECT 'acc-4203-' || b."id", b."id", '4203', 'Keuntungan Selisih Harga Beli', 'REVENUE' FROM "Branch" b;
INSERT OR IGNORE INTO "Account" ("id", "branchId", "code", "name", "type")
SELECT 'acc-5103-' || b."id", b."id", '5103', 'Kerugian Selisih Harga Beli', 'EXPENSE' FROM "Branch" b;
INSERT OR IGNORE INTO "AccountingPostingRule" ("id", "companyId", "code", "version", "name", "eventType", "priority", "status", "journalLines", "createdAt", "updatedAt")
SELECT
  'rule-purchase-return-v2-' || c."id",
  c."id",
  'PURCHASE-RETURN',
  2,
  'PURCHASE-RETURN',
  'PURCHASE_RETURN',
  100,
  'ACTIVE',
  '[{"accountCodeKey":"payable","side":"DEBIT","amountKey":"payableOffset","skipIfZero":true},{"accountCodeKey":"supplierReceivable","side":"DEBIT","amountKey":"supplierReceivable","skipIfZero":true},{"accountCodeKey":"inventory","side":"CREDIT","amountKey":"inventory"},{"accountCodeKey":"inputTax","side":"CREDIT","amountKey":"inputTax","skipIfZero":true}]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c;
