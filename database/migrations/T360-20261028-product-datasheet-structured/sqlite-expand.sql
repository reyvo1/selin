-- Expand-only: nullable structured datasheet columns.
ALTER TABLE "Product" ADD COLUMN "datasheet" JSONB;
ALTER TABLE "Product" ADD COLUMN "datasheetAttributes" JSONB;
ALTER TABLE "Product" ADD COLUMN "datasheetAttachments" JSONB;
ALTER TABLE "Product" ADD COLUMN "attributes" JSONB;
ALTER TABLE "Product" ADD COLUMN "attachments" JSONB;
