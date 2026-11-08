-- Expand-only: add payload/audit fields to TransferFile.
ALTER TABLE "TransferFile" ADD COLUMN "payload" TEXT;
ALTER TABLE "TransferFile" ADD COLUMN "checksum" TEXT;
ALTER TABLE "TransferFile" ADD COLUMN "rowIngested" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TransferFile" ADD COLUMN "rowRejected" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TransferFile" ADD COLUMN "processedBy" TEXT;
ALTER TABLE "TransferFile" ADD COLUMN "processedAt" DATETIME;
CREATE INDEX IF NOT EXISTS "TransferFile_companyId_direction_status_idx" ON "TransferFile"("companyId","direction","status");
