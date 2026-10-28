# T360-20261028-coa-per-warehouse

Adds optional `warehouseId` to `Account`, allowing Chart of Accounts / ledger accounts to be
scoped to a warehouse in addition to the company/branch-level default.

**Intent.** Accounts default to branch/company scope (`warehouseId IS NULL`).
A non-null `warehouseId` restricts the account to that warehouse. Existing rows
remain branch-level defaults.

**Expand-only, no backfill.** Column is nullable and no existing row is rewritten.

**Rollback.** Deploy the previous application version and leave the nullable column in place.

**Verification.** `npm run db:migrations:rehearse:sqlite`, plus `tests/prisma-schema-field-parity.test.mjs`.
