# T360-20261028-tax-per-warehouse

Adds optional `warehouseId` to `TaxCode` and `TaxRule`, allowing tax configuration to be
scoped to a warehouse in addition to the company-level default.

**Intent.** Tax codes and tax rules default to company scope (`warehouseId IS NULL`).
A non-null `warehouseId` restricts the configuration to that warehouse. Existing rows
remain company-level defaults.

**Expand-only, no backfill.** Columns are nullable and no existing row is rewritten.

**Rollback.** Deploy the previous application version and leave the nullable columns in place.

**Verification.** `npm run db:migrations:rehearse:sqlite`, plus `tests/prisma-schema-field-parity.test.mjs`.
