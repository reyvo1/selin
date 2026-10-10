# Release Evidence: T360-20261005-154000 - P6A Retail Transaction Completion

## Work Item Status: STAGING → RELEASE_READY

### Acceptance Criteria Verification

| # | Criteria | Evidence | Status |
|---|----------|----------|--------|
| 1 | POS/sale API consume active PAYMENT_METHOD authority | `tests/p6a-retail-transaction-completion.test.mjs` lines 90-99: `salesDto` no longer has legacy IsIn enum, `sales` uses `type: 'PAYMENT_METHOD'`, `resolveSalePayments` | ✅ PASS |
| 2 | Tender configuration distinguishes settlement account/behavior, provider/ref requirements, refund policy, offline eligibility, cash-change, MDR/fee | `tenderPolicy` exports `settlementAccountCode`, `requiresProvider`, `requiresReference`, `feeRatePercent` | ✅ PASS |
| 3 | Multiple dynamic tenders settle one sale only when server-validated total equals tender due | `sales` has `paymentTotal.equals(tenderDue)` check | ✅ PASS |
| 4 | Explicit customer on-account sales create journal-backed AR | `finance` shows `referenceType: 'Order' | 'Sale'`, `CUSTOMER_RECEIPT` type, idempotent creation | ✅ PASS |
| 5 | Refund/reversal uses immutable original tender/AR facts | `returns` uses `methodSnapshot`, `refundDetails`, `resolveSaleRefundAllocations` | ✅ PASS |
| 6 | Admin manages real tender policy; POS uses backend tender authority | `adminMaster` exposes `PAYMENT_METHOD`, `settlementAccountCode`, `feeRatePercent`; `pos` maps `tenderMethods` | ✅ PASS |
| 7 | Browser UAT consumes runtime tender master | `browserUat` queries `/master-data/references?type=PAYMENT_METHOD`, `P6A_TENDER_MASTER_RUNTIME` check | ✅ PASS |

### Test Results

```
tests/p6a-retail-transaction-completion.test.mjs: 10/10 PASS
- Payment schema persists immutable tender/accounting snapshot fields (SQLite + PostgreSQL)
- Negative control: migrations cannot be deleted/reordered/duplicated/backdated
- P6A tender methods master-backed, no legacy four-code enum
- Split/partial tender server-authoritative and exact
- Accounting routes each tender through accounting event + balanced additionalJournalLines
- Customer on-account settlement reuses finance operations (bounded, idempotent)
- Refunds preserve original tender snapshot, bound receivable reversals
- Admin/POS surfaces expose tender policy, split payment, provider/ref, on-account
- Browser UAT consumes runtime tender master, fails closed on missing dynamic options
- Governance truth recorded without advancing P5/Human Stage-20
```

### Migration Evidence

| Migration | Provider | Type | Status |
|-----------|----------|------|--------|
| T360-20261005-p6a-retail-transaction-completion | SQLite | Expand-only (ADD COLUMN methodName, methodReferenceId, methodSnapshot, settlementAccountCode, settlementBehavior, feeAmount, feeAccountCode) | ✅ Registered |
| T360-20261005-p6a-retail-transaction-completion | PostgreSQL | Expand-only (same fields) | ✅ Registered |
| T360-20261009-ppob-paid-fulfillment | SQLite | Expand-only (paymentAccountingEventId, settlementAccountingEventId, refundAccountingEventId) | ✅ Registered after P6A |
| T360-20261009-ppob-paid-fulfillment | PostgreSQL | Expand-only (same fields) | ✅ Registered after P6A |

**Migration Order Verified**: P6A before PPOB (`migrationOrder.migrations` index check) ✅

### Schema Parity

| Model | SQLite | PostgreSQL | Fields Added |
|-------|--------|------------|--------------|
| Payment | ✅ | ✅ | methodName, methodReferenceId, methodSnapshot, settlementAccountCode, settlementBehavior, feeAmount, feeAccountCode |

### Quality Gates

| Gate | Result |
|------|--------|
| `workflow:validate` | ✅ PASS |
| `validate:repo` | ✅ PASS |
| `lint` (6 workspaces) | ✅ PASS |
| `audit:p5:visual` | ✅ PASS |
| `build` (4 apps + API + worker) | ✅ PASS |
| Dependency-free tests | ✅ 1818/1818 PASS |

### Feature Flag

- `retail_transaction_completion`: `IMPLEMENTED_RUNTIME_PENDING` (P6A engineering wave label)
- Does NOT advance canonical `currentPhase` (P5) or `Human Stage-20`
- `productReady=false`, `humanStage20=PENDING` unchanged

### Rollback Plan

1. Rollback application code first
2. Leave additive P6A columns in place (never delete historical tender/refund snapshots)
3. Use canonical reversal/compensating operations for posted financial effects
4. Never destructively drop columns or reverse posted journals

### Monitoring

- Sale/payment validation failures
- Split-total mismatch
- On-account outstanding/receipt bounds
- Refund allocation errors
- Journal-balance guards
- Offline replay conflicts
- Settlement/MDR read-model discrepancies

---

**Evidence Package Complete** ✅
**Status**: Ready for RELEASE_READY
**Next**: Human Stage-20 acceptance (separate gate)
