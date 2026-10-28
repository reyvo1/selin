-- Expand-only: nullable structured datasheet columns.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "datasheet" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "datasheetAttributes" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "datasheetAttachments" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
