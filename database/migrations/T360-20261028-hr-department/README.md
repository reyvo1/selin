# T360-20261028-hr-department

Adds the `Department` HR dimension table (if missing) to the SQLite local profile and the PostgreSQL CI/production profile.

**Intent.** Department is the HR dimension referenced by employees and (where useful) transactions for retail costing/accounting.

**Expand-only, no backfill.** The table is created only if it does not already exist; no existing row is rewritten.

**Rollback.** Deploy the previous application version and leave the table in place.

**Verification.** `npm run db:migrations:rehearse:sqlite`, plus `tests/prisma-schema-field-parity.test.mjs`.
