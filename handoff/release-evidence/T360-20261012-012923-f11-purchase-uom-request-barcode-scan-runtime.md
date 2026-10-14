# Release Evidence — T360-20261012-012923

F11 purchase UOM: purchase request, barcode entry, factor-aware receiving scan, runtime evidence.

## Scope

`config/functional-depth-roadmap.json` listed F11 as the only phase still
`NEXT_SOURCE_IMPLEMENTATION`. This work item closes the source-level gap and records runtime evidence.
It does **not** advance canonical product readiness.

## Defects fixed

1. **`PurchaseRequestItem` had no UOM column at all.** `purchase-orders.service.ts` and
   `goods-receipts.service.ts` already converted and snapshotted purchase UOM, but
   `purchase-requests.service.ts:169` built every PO line as
   `{ productId, orderedQty: item.quantity, unitCost }` with no `productUnitId`, so
   `quantityFactor` was always 1. An operator asking for 3 cartons got a purchase order for 3 **base**
   units. `estimatedUnitCost` had the same shape problem: the approval amount multiplied it by
   `quantity` with no stated unit.

2. **Receiving inspection scanned one base unit per barcode hit.**
   `operations-control.service.ts` used `scannedQty: { increment: 1 }` while
   `InspectionResultItem.expectedQty` is canonical base quantity
   (`goods-receipts.service.ts` sets `expectedQty: item.quantityReceived`). Receiving 2 cartons of 24
   meant scanning the same carton 48 times, and the row pick
   `(row.scannedQty ?? 0) < (row.expectedQty ?? 0)` allowed the final scan to push `scannedQty` past
   `expectedQty`.

3. **The F11 audit gap text was stale and had been contradicting the source.** The generator
   `scripts/run-f1-backend-ui-audit.mjs` and its four generated mirrors
   (`config/f1-backend-ui-audit.json`, `config/p5-full-ui-root-audit.json`,
   `docs/F1-BACKEND-UI-AUDIT.md`, `docs/P5-FULL-UI-ROOT-AUDIT.md`) asserted that PO and goods receipt
   "masih berbasis orderedQty/unitCost tanpa purchase UOM conversion first-class".

## Change

- New `apps/api/src/common/purchase-uom.ts`: one purchase-side resolver
  (`resolvePurchaseUnitLine`, `toPurchaseBaseQuantity`, `toPurchaseBaseUnitCost`) mirroring
  `common/transaction-uom.ts` on the selling side — base unit must be active in the company UNIT
  master, ProductUnit activity and variant match, barcode/ProductUnit conflict, integer-safe factor,
  factor > 1 implies a different unit code, safe-integer base quantity. Purchase request, purchase
  order and goods receipt all use it.
- Expand-only migration `database/migrations/T360-20261012-f11-purchase-uom-request/` (SQLite +
  PostgreSQL, registered in `config/expand-migration-order.json`) adds an immutable snapshot to
  `PurchaseRequestItem`: `unitQuantity`, `quantityFactor`, `unitCode`, `productUnitId`, `variantId`,
  `sourceBarcode`. `quantity` stays canonical base. `estimatedUnitCost` is explicitly per purchase
  unit and the approval amount is `estimatedUnitCost * unitQuantity`; legacy rows carry factor 1 and a
  null `unitQuantity`, so their arithmetic is unchanged.
- `convert()` forwards the request snapshot. PO and PR accept a purchase `barcodeCode` that must
  resolve to the same product.
- Inspection scanning uses the scanned barcode's conversion factor and only selects a line whose
  remaining capacity fits that unit; an overshoot is rejected.

## Evidence — local

| Gate | Result |
| --- | --- |
| `node --test tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs` | 5/5 PASS |
| `npm run test:dependency-free` | **1827/1827 PASS** |
| `npm run test --workspaces --if-present` | PASS |
| `npm run lint` | PASS, all workspaces, strict TypeScript |
| `npm run workflow:validate` | PASS, 47 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1198 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS, 7 audits |
| `npm run ci:ui:audit` | PASS, 514 controls |

### Migration rehearsal — executed, not asserted

Both dialects were rehearsed by actually applying the new migration on top of the previous commit's
schema and comparing the full schema contract (tables, columns, enums, critical indexes):

```
T360_MIGRATION_BASE_REF=56cbd9c db:migrations:rehearse:postgres
  → APPLIED postgresql T360-20261012-f11-purchase-uom-request
  → Migration rehearsal PASS — 1 migration(s) membawa baseline 56cbd9c... ke schema saat ini.
     (against a real PostgreSQL 16.15 container)

T360_MIGRATION_BASE_REF=56cbd9c db:migrations:rehearse:sqlite
  → APPLIED sqlite T360-20261012-f11-purchase-uom-request
  → Migration rehearsal PASS
```

### Runtime test — real database, real services

`tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs` proves against SQLite with the actual
services, a 24-factor purchase unit:

- PR of 3 cartons → item snapshot `unitQuantity 3`, `quantityFactor 24`, `quantity 72` base; approval
  amount `300000 * 3`; `convert()` → PO line carrying the same `productUnitId`/`quantityFactor`, with
  `orderedQty 72` base, `unitCost 12500` derived from the carton price, `subtotal 900000`.
- Barcode entry resolves to the ProductUnit the barcode points at; a barcode belonging to another
  product is rejected.
- GRN of 2 cartons with 1 damaged → 48 received / 24 damaged / 24 accepted, no stock movement while
  still a draft.
- Confirm → inventory +24 base, exactly one append-only `InventoryMovement`, PO `receivedQty 24`, and a
  balanced `PURCHASE_RECEIPT_CREDIT` journal where the inventory basis is the base unit cost and the
  input tax is computed from base net.
- Editing `ProductUnit.quantityFactor` to 99 after posting changes nothing: the receipt snapshot, the
  received quantity, the accepted quantity and the stock movement are all unchanged.
- Inspection scanning: one carton barcode scan advances the line by 24, two scans close 48 expected,
  a third is rejected instead of overshooting.

Three existing gates asserted the old inline arithmetic (`productUnit.findFirst` inside
`purchase-orders.service.ts`, inline `baseUnitCost = purchaseUnitCost.div(quantityFactor)`, and
`scannedQty` increment 1). Each was **rewritten to pin the new invariant**, not deleted: the shared
resolver must be used by all three purchase documents, and scanning must be factor-aware and unable to
overshoot.

## Evidence — GitHub, exact commit `32f8356`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Toko360 Full Automated UAT | `38543313276` | **success** |
| Toko360 Full System Simulation | `38543313366` | **success** |
| Workflow Governance | `38543313270` | **success** |

From the UAT job log:

```
Build gate PASS — evidence: handoff/quality/build-gate-latest.json
Migration rehearsal PASS — 1 migration(s) membawa baseline 56cbd9c... ke schema saat ini.
STEP_BUILD: success          STEP_MIGRATION: success      STEP_SCHEMA: success
STEP_STAGE18: success        STEP_STAGE19: success        STEP_STAGE20: success
STEP_P2A_MULTI_UOM: success  STEP_R8_RELEASE: success     STEP_CANDIDATE: success
(all 34 STEP_* outcomes: success)
STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING
Automated UAT PASS.
```

## Not claimed

- F11 is now `SOURCE_IMPLEMENTATION_COMPLETE_UAT_DEFERRED`, a **source statement only**.
- P5 remains `IMPLEMENTED_RUNTIME_PENDING`, `humanStage20=PENDING`, `productReady=false`.
- R8 (`T360-20260925-143000`) remains `BLOCKED` awaiting Human Visual Acceptance P5.
- No change to Human Stage-20; automation does not mutate human acceptance.
- No schema or data is rewritten by any rollback: the migration is expand-only, and reverting the
  feature-flag path leaves the new columns inert.