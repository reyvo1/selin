# T360-20261028-trade-in

Adds `TradeIn` foundation for sales trade-in: original product, trade value, new product, and status.

**Intent.** Foundation only: model, migration, service/DTO, and admin UI list/create. Accounting/journal and stock handling are not implemented yet.

**Expand-only, no backfill.** New table only. No existing row is rewritten.

**Backfill plan.** None.

**Index/query impact.** Indexes on tenant/status and original product.

**Rollback.** Deploy previous application version and leave table in place.

**Verification.** `npm run db:migrations:rehearse:sqlite`, plus `tests/prisma-schema-field-parity.test.mjs`.
