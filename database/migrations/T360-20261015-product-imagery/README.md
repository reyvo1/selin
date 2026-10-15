# T360-20261015-product-imagery

Adds `Product.imageUrl TEXT` — a nullable photo URL — to the SQLite local profile and the PostgreSQL
CI/production profile.

**Intent.** A product photo is the primary recognition cue on a shelf, on a till and on a storefront
card. The model had no way to hold one, so every surface substituted a generic icon or a single
letter. The column is a presentation attribute, not business data: no calculation, journal, stock
movement, price or tax rule reads it, and nothing about a sale changes when it is present or absent.

**Expand-only, no backfill.** The column is nullable and no existing row is rewritten. A catalog that
has never been photographed stays exactly as it is, and every surface keeps the fallback it renders
today. There is no default value, so no row acquires a photo it never had.

**Backfill plan.** None. Photographing a catalog is operator work done through the product form after
release, not a data migration.

**Index/query impact.** None. The column is never used in a WHERE, JOIN or ORDER BY, so no index is
created and no existing plan changes. Reads of the column ride along with the row fetch the product
list already performs.

**Rollback.** Deploy the previous application version and leave the nullable column in place. Do not
drop columns during incident rollback. The column carries no data that any other column depends on,
so leaving it costs nothing and dropping it would require a table reconstruction on SQLite.

**Verification.** `npm run db:migrations:rehearse:sqlite` and `npm run db:migrations:rehearse:postgres`,
plus `tests/prisma-schema-field-parity.test.mjs`, which requires the column in all three schemas.
