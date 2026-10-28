-- Expand-only: HR department foundation. Creates the Department table if it does not yet exist; no existing row is rewritten.
CREATE TABLE IF NOT EXISTS "Department" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "costCenterId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_code_key"
  ON "Department"("companyId", "code");
CREATE INDEX IF NOT EXISTS "Department_companyId_isActive_name_idx"
  ON "Department"("companyId", "isActive", "name");
