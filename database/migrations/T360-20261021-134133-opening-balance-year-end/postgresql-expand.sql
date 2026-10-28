-- Expand-only: opening balance batches/rows, opening AR/AP documents and
-- settlements, and year-end close runs/lines. No existing table is rewritten.

DO $$ BEGIN
  CREATE TYPE "OpeningBalanceType" AS ENUM ('STOCK', 'AR', 'AP', 'GL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpeningBalanceStatus" AS ENUM ('DRAFT', 'VALIDATING', 'VALIDATED', 'WAITING_APPROVAL', 'APPROVED', 'POSTING', 'POSTED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpeningLedgerKind" AS ENUM ('AR', 'AP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpeningLedgerStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OpeningBalanceBatch" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "type" "OpeningBalanceType" NOT NULL,
  "cutoverDate" TIMESTAMP(3) NOT NULL,
  "sourceFileName" TEXT,
  "sourceChecksum" TEXT,
  "status" "OpeningBalanceStatus" NOT NULL DEFAULT 'DRAFT',
  "operationKey" TEXT NOT NULL,
  "controlAccountCode" TEXT,
  "offsetAccountCode" TEXT,
  "suspenseAccountCode" TEXT,
  "sourceStorageKey" TEXT,
  "retentionUntil" TIMESTAMP(3),
  "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "validRowCount" INTEGER NOT NULL DEFAULT 0,
  "errorRowCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpeningBalanceBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningBalanceBatch_company_operation_key"
  ON "OpeningBalanceBatch"("companyId", "operationKey");
CREATE INDEX IF NOT EXISTS "OpeningBalanceBatch_company_branch_type_cutover_idx"
  ON "OpeningBalanceBatch"("companyId", "branchId", "type", "cutoverDate");
CREATE INDEX IF NOT EXISTS "OpeningBalanceBatch_company_branch_status_created_idx"
  ON "OpeningBalanceBatch"("companyId", "branchId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OpeningBalanceBatch_company_status_cutover_idx"
  ON "OpeningBalanceBatch"("companyId", "status", "cutoverDate");

CREATE TABLE IF NOT EXISTS "OpeningBalanceRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payloadHash" TEXT NOT NULL,
  "rawPayload" JSONB,
  "productId" TEXT,
  "warehouseId" TEXT,
  "locationCode" TEXT,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "quantity" INTEGER,
  "unitCost" DECIMAL(20,6),
  "customerId" TEXT,
  "supplierId" TEXT,
  "documentNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxCodeId" TEXT,
  "taxCodeVersion" INTEGER,
  "taxRateSnapshot" DECIMAL(20,6),
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "accountCode" TEXT,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpeningBalanceRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpeningBalanceRow_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "OpeningBalanceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningBalanceRow_batchId_rowNumber_key"
  ON "OpeningBalanceRow"("batchId", "rowNumber");
CREATE INDEX IF NOT EXISTS "OpeningBalanceRow_batch_status_row_idx"
  ON "OpeningBalanceRow"("batchId", "status", "rowNumber");
CREATE INDEX IF NOT EXISTS "OpeningBalanceRow_product_warehouse_idx"
  ON "OpeningBalanceRow"("productId", "warehouseId");
CREATE INDEX IF NOT EXISTS "OpeningBalanceRow_customer_document_idx"
  ON "OpeningBalanceRow"("customerId", "documentNumber");
CREATE INDEX IF NOT EXISTS "OpeningBalanceRow_supplier_document_idx"
  ON "OpeningBalanceRow"("supplierId", "documentNumber");

CREATE TABLE IF NOT EXISTS "OpeningLedgerDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "rowId" TEXT NOT NULL,
  "kind" "OpeningLedgerKind" NOT NULL,
  "customerId" TEXT,
  "supplierId" TEXT,
  "documentNumber" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxCodeId" TEXT,
  "taxCodeVersion" INTEGER,
  "taxRateSnapshot" DECIMAL(20,6),
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "settledAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "outstandingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "controlAccountCode" TEXT NOT NULL,
  "status" "OpeningLedgerStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpeningLedgerDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpeningLedgerDocument_rowId_fkey"
    FOREIGN KEY ("rowId") REFERENCES "OpeningBalanceRow"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningLedgerDocument_rowId_key"
  ON "OpeningLedgerDocument"("rowId");
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningLedgerDocument_company_branch_kind_number_key"
  ON "OpeningLedgerDocument"("companyId", "branchId", "kind", "documentNumber");
CREATE INDEX IF NOT EXISTS "OpeningLedgerDocument_company_branch_kind_status_due_idx"
  ON "OpeningLedgerDocument"("companyId", "branchId", "kind", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "OpeningLedgerDocument_customer_status_due_idx"
  ON "OpeningLedgerDocument"("customerId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "OpeningLedgerDocument_supplier_status_due_idx"
  ON "OpeningLedgerDocument"("supplierId", "status", "dueDate");

CREATE TABLE IF NOT EXISTS "OpeningLedgerSettlement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "financeTransactionId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "operationKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpeningLedgerSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpeningLedgerSettlement_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "OpeningLedgerDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningLedgerSettlement_company_branch_operation_key"
  ON "OpeningLedgerSettlement"("companyId", "branchId", "operationKey");
CREATE UNIQUE INDEX IF NOT EXISTS "OpeningLedgerSettlement_document_finance_key"
  ON "OpeningLedgerSettlement"("documentId", "financeTransactionId");
CREATE INDEX IF NOT EXISTS "OpeningLedgerSettlement_company_branch_settled_idx"
  ON "OpeningLedgerSettlement"("companyId", "branchId", "settledAt");
CREATE INDEX IF NOT EXISTS "OpeningLedgerSettlement_finance_idx"
  ON "OpeningLedgerSettlement"("financeTransactionId");

CREATE TABLE IF NOT EXISTS "YearEndCloseRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "retainedEarningsAccountCode" TEXT NOT NULL,
  "incomeSummaryAccountCode" TEXT NOT NULL,
  "netIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "previewJson" JSONB,
  "operationKey" TEXT NOT NULL,
  "approvedBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "journalEntryId" TEXT,
  "reversalEventId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "YearEndCloseRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "YearEndCloseRun_company_branch_year_operation_key"
  ON "YearEndCloseRun"("companyId", "branchId", "fiscalYear", "operationKey");
CREATE UNIQUE INDEX IF NOT EXISTS "YearEndCloseRun_posted_scope_key"
  ON "YearEndCloseRun"("companyId", "branchId", "fiscalYear") WHERE "status" = 'POSTED';
CREATE INDEX IF NOT EXISTS "YearEndCloseRun_company_branch_year_status_idx"
  ON "YearEndCloseRun"("companyId", "branchId", "fiscalYear", "status");
CREATE INDEX IF NOT EXISTS "YearEndCloseRun_company_status_created_idx"
  ON "YearEndCloseRun"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "YearEndCloseRun_journal_idx"
  ON "YearEndCloseRun"("journalEntryId");

CREATE TABLE IF NOT EXISTS "YearEndCloseLine" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "lineType" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "YearEndCloseLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "YearEndCloseLine_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "YearEndCloseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "YearEndCloseLine_run_type_idx"
  ON "YearEndCloseLine"("runId", "lineType");
CREATE INDEX IF NOT EXISTS "YearEndCloseLine_account_idx"
  ON "YearEndCloseLine"("accountCode");
