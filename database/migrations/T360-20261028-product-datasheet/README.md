# T360-20261028-product-datasheet

Adds `Product.datasheetUrl TEXT` — a nullable technical document / datasheet URL — to the SQLite local profile and the PostgreSQL CI/production profile.

**Intent.** A product datasheet is a presentation attribute, like `imageUrl`: it holds a link to technical documentation and does not affect price, tax, stock, or journal data.

**Expand-only, no backfill.** The column is nullable and no existing row is rewritten. There is no default value.

**Backfill plan.** None.

**Index/query impact.** None. No index is created.

**Rollback.** Deploy the previous application version and leave the nullable column in place.

**Verification.** `npm run db:migrations:rehearse:sqlite`, plus `tests/prisma-schema-field-parity.test.mjs`.
