-- Expand-only: costing policy, append-only cost events, moving-average state,
-- FIFO/LIFO layers and consumption, rebuild runs, and InventoryMovement.occurredAt.
-- Existing rows are not rewritten except backfilling occurredAt from createdAt.

DO $$ BEGIN
  CREATE TYPE "CostingMethod" AS ENUM ('MOVING_AVERAGE', 'FIFO', 'LIFO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CostingMode" AS ENUM ('SHADOW', 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CostingPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCostEventType" AS ENUM ('RECEIPT', 'ISSUE', 'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'PRODUCTION_CONSUME', 'PRODUCTION_OUTPUT', 'ASSET_ISSUE', 'OPENING', 'REVERSAL', 'REBUILD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCostEventStatus" AS ENUM ('POSTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCostLayerStatus" AS ENUM ('OPEN', 'CONSUMED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CostingRebuildStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
UPDATE "InventoryMovement" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
CREATE INDEX IF NOT EXISTS "InventoryMovement_warehouse_product_occurred_idx"
  ON "InventoryMovement"("warehouseId", "productId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_occurredAt_id_idx"
  ON "InventoryMovement"("occurredAt", "id");

CREATE TABLE IF NOT EXISTS "CostingPolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "scopeKey" TEXT NOT NULL,
  "method" "CostingMethod" NOT NULL,
  "mode" "CostingMode" NOT NULL DEFAULT 'SHADOW',
  "status" "CostingPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostingPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostingPolicy_company_scope_version_key"
  ON "CostingPolicy"("companyId", "scopeKey", "version");
CREATE INDEX IF NOT EXISTS "CostingPolicy_company_branch_status_idx"
  ON "CostingPolicy"("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "CostingPolicy_company_status_effective_idx"
  ON "CostingPolicy"("companyId", "status", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "InventoryCostState" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "method" "CostingMethod" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "value" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "averageCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCostState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostState_scope_key"
  ON "InventoryCostState"("companyId", "branchId", "warehouseId", "productId", "batchKey", "method");
CREATE INDEX IF NOT EXISTS "InventoryCostState_company_warehouse_product_idx"
  ON "InventoryCostState"("companyId", "warehouseId", "productId");
CREATE INDEX IF NOT EXISTS "InventoryCostState_company_branch_product_idx"
  ON "InventoryCostState"("companyId", "branchId", "productId");

CREATE TABLE IF NOT EXISTS "InventoryCostEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "movementId" TEXT,
  "eventType" "InventoryCostEventType" NOT NULL,
  "method" "CostingMethod" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "uncostedQuantity" INTEGER NOT NULL DEFAULT 0,
  "valueDelta" DECIMAL(20,6) NOT NULL,
  "unitCost" DECIMAL(20,6) NOT NULL,
  "balanceQuantity" INTEGER NOT NULL,
  "balanceValue" DECIMAL(20,6) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceLineKey" TEXT NOT NULL DEFAULT '',
  "operationKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "InventoryCostEventStatus" NOT NULL DEFAULT 'POSTED',
  "reversalOfId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCostEvent_pkey" PRIMARY KEY ("id")
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
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL DEFAULT '',
  "method" "CostingMethod" NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "originalQty" INTEGER NOT NULL,
  "remainingQty" INTEGER NOT NULL,
  "unitCost" DECIMAL(20,6) NOT NULL,
  "originalValue" DECIMAL(20,6) NOT NULL,
  "remainingValue" DECIMAL(20,6) NOT NULL,
  "status" "InventoryCostLayerStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostLayer_source_event_key"
  ON "InventoryCostLayer"("sourceEventId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_fifo_scope_idx"
  ON "InventoryCostLayer"("companyId", "branchId", "warehouseId", "productId", "batchKey", "status", "receivedAt");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_method_scope_idx"
  ON "InventoryCostLayer"("companyId", "method", "status", "receivedAt");

CREATE TABLE IF NOT EXISTS "InventoryCostConsumption" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "layerId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" DECIMAL(20,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostConsumption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostConsumption_layer_event_key"
  ON "InventoryCostConsumption"("layerId", "eventId");
CREATE INDEX IF NOT EXISTS "InventoryCostConsumption_company_layer_idx"
  ON "InventoryCostConsumption"("companyId", "layerId");
CREATE INDEX IF NOT EXISTS "InventoryCostConsumption_event_idx"
  ON "InventoryCostConsumption"("eventId");

CREATE TABLE IF NOT EXISTS "CostingRebuildRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "method" "CostingMethod" NOT NULL,
  "mode" "CostingMode" NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "status" "CostingRebuildStatus" NOT NULL DEFAULT 'PENDING',
  "checkpoint" TEXT,
  "statistics" JSONB,
  "operationKey" TEXT NOT NULL,
  "approvedBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostingRebuildRun_pkey" PRIMARY KEY ("id")
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
INSERT INTO "Account" ("id", "branchId", "code", "name", "type")
SELECT 'acc-4203-' || b."id", b."id", '4203', 'Keuntungan Selisih Harga Beli', 'REVENUE'
FROM "Branch" b
ON CONFLICT ("branchId", "code") DO NOTHING;
INSERT INTO "Account" ("id", "branchId", "code", "name", "type")
SELECT 'acc-5103-' || b."id", b."id", '5103', 'Kerugian Selisih Harga Beli', 'EXPENSE'
FROM "Branch" b
ON CONFLICT ("branchId", "code") DO NOTHING;
INSERT INTO "AccountingPostingRule" ("id", "companyId", "code", "version", "name", "eventType", "priority", "status", "journalLines", "createdAt", "updatedAt")
SELECT
  'rule-purchase-return-v2-' || c."id",
  c."id",
  'PURCHASE-RETURN',
  2,
  'PURCHASE-RETURN',
  'PURCHASE_RETURN',
  100,
  'ACTIVE',
  '[{"accountCodeKey":"payable","side":"DEBIT","amountKey":"payableOffset","skipIfZero":true},{"accountCodeKey":"supplierReceivable","side":"DEBIT","amountKey":"supplierReceivable","skipIfZero":true},{"accountCodeKey":"inventory","side":"CREDIT","amountKey":"inventory"},{"accountCodeKey":"inputTax","side":"CREDIT","amountKey":"inputTax","skipIfZero":true}]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "code", "version") DO NOTHING;
