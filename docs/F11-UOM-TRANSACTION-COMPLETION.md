# F11 / P2A — Transaction UOM Completion

Status: **P2A SOURCE IMPLEMENTED — EXACT-SOURCE RUNTIME EVIDENCE PENDING**

## Authority
- `Product.unit` remains the integer base inventory unit.
- `ProductUnit` is authoritative when a new sale/order chooses an alternative transaction UOM and `quantityFactor`.
- Barcode is only a shortcut to a ProductUnit or backward-compatible unit snapshot; it is not the unit master.
- After a transaction row is created, its persisted UOM snapshot becomes historical authority. Fulfillment, return and refund must not reconstruct conversion semantics from the current ProductUnit row.

## Purchase and goods receipt
- Purchase request, purchase order and goods receipt share ONE resolver: `apps/api/src/common/purchase-uom.ts`.
  `resolvePurchaseUnitLine` validates the base unit in the company UNIT master reference, the ProductUnit activity and
  variant match, barcode/ProductUnit conflict, integer-safe factor, the "factor > 1 implies a different unitCode"
  rule, and an active master unit for every non-base purchase unit. `toPurchaseBaseQuantity` and
  `toPurchaseBaseUnitCost` are the only places where purchase quantity and cost are converted.
  Previously each document carried its own inline arithmetic, which is how PurchaseRequest silently
  collapsed every line to factor 1.
- Purchase request (`PurchaseRequestItem`), purchase order (`PurchaseOrderItem`) and goods receipt
  (`GoodsReceiptItem`) each store the same immutable snapshot: `variantId`, `productUnitId`, `unitCode`,
  `unitQuantity`, `quantityFactor` (and `sourceBarcode` on request). `quantity` stays canonical base quantity.
- Purchase request input `quantity` is in the selected purchase unit, and `estimatedUnitCost` is per PURCHASE
  unit, so the approval amount is `estimatedUnitCost * unitQuantity`. Rows written before the snapshot existed
  carry factor 1 and a null `unitQuantity`, which keeps that arithmetic identical for them.
- `convert()` forwards the request snapshot into purchase order creation, so a request for 3 cartons becomes a
  PO line of 72 base units at the recorded factor rather than 3 base units.
- PO input quantity is expressed in the selected purchase UOM when `productUnitId` or a purchase `barcodeCode`
  is supplied; the barcode is only a shortcut to the same ProductUnit, never its own authority.
- `orderedQty` remains canonical base-unit quantity.
- Goods receipt converts selected-unit quantities to integer base quantity before inventory, batch, serial and
  accounting posting and preserves its UOM snapshot. Damaged quantities are converted with the same factor and
  subtracted, so only accepted base quantity can reach stock, PO `receivedQty` and the journal.
- Receiving inspection scanning counts the scanned barcode's conversion factor. `InspectionResultItem.expectedQty`
  is canonical base quantity, so scanning one carton of 24 advances the line by 24 rather than forcing the
  operator to scan the same carton 24 times; a scan that would overshoot `expectedQty` is rejected.

## Sales / POS
- Sale DTO supports direct `productUnitId` and `variantId`.
- POS and online order now share `apps/api/src/common/transaction-uom.ts` as the canonical selling-UOM resolver.
- ProductUnit/variant/barcode validation and factor-safe base conversion therefore cannot drift between POS and storefront order creation.
- Unit-specific pricing is resolved server-side; package fallback scales the product/variant base price by the persisted factor.

## Online order and fulfillment
- Storefront checkout sends transaction-unit quantity plus selected `productUnitId`/`variantId`.
- `OrderItem.unitQuantity` stores transaction quantity; `OrderItem.quantity` stores canonical base quantity.
- `OrderItem` also snapshots `variantId`, `productUnitId`, `unitCode`, `quantityFactor`, and `sourceBarcode` together with historical unit price/net/tax/gross fields.
- Reservation, batch, serial and inventory fulfillment continue using base quantity.
- Shipment package metadata carries both transaction UOM and base quantity; accounting lines use transaction quantity + selling-unit amount while inventory/COGS use base quantity + base cost.

## Return and refund lineage
- `OrderReturnItem`, `SaleReturnItem`, and `PurchaseReturnItem` persist the same transaction UOM lineage fields.
- Customer order-return input is in the historical OrderItem UOM. Server converts to base quantity from the persisted OrderItem `quantityFactor`, never from current ProductUnit configuration.
- Order-return net/tax/gross reversal values are proportional copies of historical OrderItem amounts.
- Sale and purchase returns copy source UOM identity/factor; their inventory quantity remains base units for backward compatibility.
- Refund/restock/accounting/tax posting therefore uses historical source snapshots rather than current catalog configuration.

## Storefront
- Product list/detail exposes server-authoritative effective price for active ProductUnits.
- Customer can choose selling UOM/package on product detail.
- Cart identity includes product + ProductUnit + variant, clamps quantity by base stock divided by the selected factor, and displays unit price/UOM explicitly.
- Account order history and return form use the persisted transaction UOM quantity instead of presenting base quantity as if it were the customer unit.

## Database
- Original F11 migration: `database/migrations/T360-20260923-f11-transaction-uom/`.
- P2A expand-only lineage migration: `database/migrations/T360-20260925-p2a-transaction-uom-lineage/`.
- Purchase-request snapshot migration: `database/migrations/T360-20261012-f11-purchase-uom-request/`
  (expand-only, adds six nullable columns plus a `quantityFactor` default of 1 to `PurchaseRequestItem`).
- Existing rows remain compatible with `quantityFactor=1` and nullable snapshots. No column is dropped or
  renamed, so a rollback leaves the new columns inert rather than requiring a destructive migration.

## Tests
- Runtime (real database, real services, SQLite): `tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs`
  proves a 24-factor purchase unit end to end - PR snapshot and convert, barcode resolution, 2 cartons received
  with 1 damaged giving 48 received / 24 damaged / 24 accepted, stock and the single append-only movement,
  a balanced PURCHASE_RECEIPT_CREDIT journal whose basis is the base unit cost, snapshot immutability after a
  master factor edit, and factor-aware inspection scanning.
- Source contract: `tests/f11-transaction-uom-integration.test.mjs` and `tests/procurement-integrity.test.mjs`
  pin that all three purchase documents use the shared resolver instead of re-deriving conversion.

## Required runtime closure
Exact-source PostgreSQL evidence must prove a mixed-UOM storefront order can be created and fulfilled, then returned/refunded after the current ProductUnit configuration is changed/deactivated, while:
1. historical UOM semantics remain unchanged;
2. inventory movement uses the original base quantity;
3. accounting remains balanced;
4. tax reversal matches the original historical tax snapshot.

That was the state as of this document's authoring (2026-09-23). `config/product-completeness.json` now records `audit:A-03 = RUNTIME_VERIFIED`, closed on exact-source commit `899685ce23c08c8a0246867afc0c78a36507e674` with the P2A mixed-UOM probe PASS. The probe evidence file itself is not present in every working copy; if you need to re-verify A-03, regenerate it rather than trusting either number.
