# T360-20261028-product-datasheet-structured

Adds structured datasheet columns (`datasheet`, `datasheetAttributes`, `datasheetAttachments`, `attributes`, `attachments`) as nullable JSON to Product in both profiles.

**Intent.** Upgrade product datasheet from link-only (`datasheetUrl`) to structured attributes/attachments while keeping the legacy link.

**Expand-only, no backfill.** Columns are nullable JSON; no existing row is rewritten.

**Rollback.** Deploy previous version and leave columns.

**Verification.** `npm run db:migrations:rehearse:sqlite`, `npm run db:migrations:rehearse:postgres`, plus `tests/prisma-schema-field-parity.test.mjs`.
