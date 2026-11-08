# T360-20261107-consignment-relations

Enforces referential integrity on the consignment subledger: ConsignmentItem ↔
ConsignmentOrder / Product, ConsignmentSettlement ↔ ConsignmentOrder.

**Intent.** J01–J08 consignment completion: items carry a product reference,
settlements carry an order reference, so billing/return flows can traverse the
graph.

**Expand-only, no backfill.** Tables already exist; this only adds FK constraints.
No existing row is rewritten.

**Backfill plan.** None.

**Index/query impact.** Two secondary indexes on consignmentOrderId.

**Rollback.** Deploy previous application version; leave constraints in place.

**Verification.** `npm run db:migrations:rehearse:sqlite` + Prisma field-parity test.
