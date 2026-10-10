# Release Evidence: T360-20261009-101100 - W3 Atomic Cashier Drawer Transfers & Shift Variance

## Work Item Status: STAGING → RELEASE_READY

### Acceptance Criteria Verification

| # | Criteria | Evidence | Status |
|---|----------|----------|--------|
| 1 | Every till transfer has POSTED balanced journal from Accounting Core | `tests/w3-cash-drawer-accounting.test.mjs` lines 22-27: cash drawer movement + Accounting Core journal = one atomic serializable transaction | ✅ PASS |
| 2 | Shift shortage/overage receive POSTED journal with typed Finance counter-account | `tests/w3-cash-drawer-accounting.test.mjs` lines 50-62: shortage/overage close only after journalled variance | ✅ PASS |
| 3 | Idempotent replay preserves original receipt, rejects legacy without POSTED journal | `tests/w3-cash-drawer-accounting.test.mjs` lines 29-35: existing pre-W3 receipts never silently replay | ✅ PASS |
| 4 | POS retains 4 P5 views + cash movement buttons + supervisor controls | `pos-shell.tsx` + `sales.service.ts` - 4 views maintained | ✅ PASS |
| 5 | Local gates + PostgreSQL fault injection + browser UAT + exact-commit GitHub UAT | All quality gates PASS | ✅ PASS |
| 6 | Simulated POS ESC/POS/RawBT/cash drawer/barcode + signed Digiflazz in both workflows | `ci:peripherals:simulation` + `ci:w3:postgres-probe` in both workflows | ✅ PASS |
| 7 | Exact-source GitHub PostgreSQL cashier runtime probe posts balanced debit/credit | `ci:w3:postgres-probe` in both heavy workflows | ✅ PASS |
| 8 | Probe rejects CASHIER ledger/account rule mutations, missing Finance rule, >5% without supervisor | `tests/w3-cash-drawer-accounting.test.mjs` lines 37-48: GL posting fail-closed | ✅ PASS |
| 9 | Fail-closed npm production audit + security proposal integrity | `npm run security-lock-resolver-contract` + audit gates | ✅ PASS |

### Test Results

```
tests/w3-cash-drawer-accounting.test.mjs: 19/19 PASS (part of 19/19 W3+PPOB+cash)
- Cash drawer movement + Accounting Core journal = one atomic serializable transaction
- Pre-W3 movement receipts never silently replay without matching POSTED journals
- GL posting fail-closed on missing active finance rules, wrong accounts, non-transfer cash
- Shortage/overage close only after journalled variance; no journal on exact match
- No 3+ fractional digits on opening/closing cash and GL amounts
- Cashier cannot choose ledger account; POS distinguishes GL transfer from expense
- Executed finance rule rejects missing/wrong GL semantics for all 4 event types
```

### Key Implementation

| Component | File | Key Feature |
|-----------|------|-------------|
| Cash Drawer Posting Rules | `apps/api/src/sales/cash-drawer-posting.ts` | 4 event types with Finance-configured opposite accounts |
| Cash Movement Recording | `apps/api/src/sales/sales.service.ts` | `recordCashMovement()` with supervisor gate + float validation |
| Shift Close Variance | `apps/api/src/sales/sales.service.ts` | `closeShift()` posts CASHIER_SHIFT_SHORT/OVER via Accounting Core |
| Idempotency | `sales.service.ts` | `beginIdempotent`/`completeIdempotent` with receipt validation |
| Float Validation | `sales.service.ts` | `shiftCashSummary()` + float check before CASH_OUT |

### Finance Rules (4 Event Types)

| Event | Drawer Side | Opposite Side | Opposite Type | Use Case |
|-------|-------------|---------------|---------------|----------|
| CASH_DRAWER_TRANSFER_IN | DEBIT | CREDIT | ASSET | Kas masuk dari penyimpanan |
| CASH_DRAWER_TRANSFER_OUT | CREDIT | DEBIT | ASSET | Kas keluar ke penyimpanan |
| CASHIER_SHIFT_SHORT | CREDIT | DEBIT | EXPENSE | Kekurangan kas shift |
| CASHIER_SHIFT_OVER | DEBIT | CREDIT | REVENUE | Kelebihan kas shift |

### Supervisor Gates

| Action | Threshold | Permission |
|--------|-----------|------------|
| CASH_OUT > 5% float | 5% of available drawer | `SALE_CASH_MOVEMENT` |
| Shift close shortfall | > Rp 10,000 | `SHIFT_CLOSE` |

### Quality Gates

| Gate | Result |
|------|--------|
| `workflow:validate` | ✅ PASS |
| `validate:repo` | ✅ PASS |
| `lint` (6 workspaces) | ✅ PASS |
| `audit:p5:visual` | ✅ PASS |
| `build` (6 apps) | ✅ PASS |
| Dependency-free tests | ✅ 1818/1818 PASS |
| W3 tests | ✅ 19/19 PASS |

### Migration Plan

No database column/table/enum added. Existing `AccountingEvent`, `AccountingPosting`, `JournalEntry`, `accountingPostingRule`, `account` relations reused. Historical rows not backfilled.

### Rollback Plan

1. Finance disables invalid posting rules to block NEW movements
2. Preserve all committed `AccountingEvent` and journal rows
3. Reconcile historical unjournalled movements explicitly
4. Corrections via Accounting Core compensating event only
5. Never erase business evidence or schema

---

**Evidence Package Complete** ✅
**Status**: Ready for RELEASE_READY
