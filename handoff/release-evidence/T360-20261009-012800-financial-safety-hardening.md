# Release Evidence: T360-20261009-012800 - POS Cash Movement & PPOB Replay Financial Safety

## Work Item Status: STAGING → RELEASE_READY

### Acceptance Criteria Verification

| # | Criteria | Evidence | Status |
|---|----------|----------|--------|
| 1 | Cash-out rejects overdrawn drawer balances + repeated small withdrawals consume float | `tests/cash-ppob-financial-safety.test.mjs` lines 16-25: float calculation includes previous cashOut, overdraft hard rejected | ✅ PASS |
| 2 | Idempotent retry of CASH_IN/CASH_OUT cannot create second movement/audit record | `tests/cash-ppob-financial-safety.test.mjs` lines 36-51: existing receipts, strict payload, after-close replay | ✅ PASS |
| 3 | Cashier terminal retains request key after authorization, failure, network timeout | `tests/cash-ppob-financial-safety.test.mjs` lines 79-91: `cashMovementOperationRef` preserves key across retries | ✅ PASS |
| 4 | PPOB replays refuse different branch, user, SKU, target, maxPrice | `tests/cash-ppob-financial-safety.test.mjs` lines 93-110: PPOB replay rejects different branch/operator/SKU/destination/price | ✅ PASS |
| 5 | Supervisor grants unique opaque keys, exact operator/branch scoping | `tests/cash-ppob-financial-safety.test.mjs` lines 65-77: `randomUUID()`, company+branch+operator+action scoping | ✅ PASS |
| 6 | Sub-cent cash amounts rejected before idempotency fingerprint | `tests/cash-ppob-financial-safety.test.mjs` lines 53-63: validation before hashing, max 2 decimals, min 0.01 | ✅ PASS |

### Test Results

```
tests/cash-ppob-financial-safety.test.mjs: 6/6 PASS
- Cash-out uses remaining drawer balance, hard rejects overdrafts before supervisor permission
- Cash movement uses existing transactional receipts, strict payload, after-close replay
- Cash amount precision validated before idempotency hashing and financial writes
- Supervisor grants use unique opaque keys, exact operator/branch scoping
- POS preserves same operation key across failed network calls and supervisor retry
- PPOB idempotent replay rejects different branch, operator, SKU, destination and price

tests/supervisor-cash-and-shift-gate.test.mjs: PASS
tests/video-parity-expansion.test.mjs: PASS (includes PPOB)
tests/p6a-retail-transaction-completion.test.mjs: PASS (includes tender policy)
```

### Key Implementation

#### POS Cash Movement (`apps/pos/app/page.tsx`)

```typescript
// Operation key preserved across retries
cashMovementOperationRef.current = { fingerprint, key }
// Fingerprint = [shift.id, type, amount, reason]
// New key only on changed intended movement
```

#### Cash Validation (`apps/api/src/sales/sales.service.ts`)

```typescript
// Float = openingCash + cashSales + cashIn - cashRefunds - cashOut
// CASH_OUT rejected if amount > float (even with supervisor grant)
// Supervisor grant only authorizes >5% float, cannot create physical cash
// Validation BEFORE idempotency hashing: min 0.01, max 2 decimals
```

#### PPOB Replay (`apps/api/src/digital-services/digital-services.service.ts`)

```typescript
// Replay rejects if: different branchId, requestedById, providerSku, customerNo, priceMatches, paymentMethod
// Worker rejects unpaid legacy events before provider calls
```

#### Supervisor Grants (`apps/api/src/supervisor-approval/supervisor-approval.service.ts`)

```typescript
// grantId = randomUUID() (opaque, unpredictable)
// Scoped: companyId + branchId + operatorId + action
// Consumed only after all preflight + journal writes succeed
// Cross-operator/cross-branch attempts fail closed
```

### Idempotency Keys

| Operation | Key Format | Scope |
|-----------|------------|-------|
| Cash Movement | `cash-drawer:${movementId}` | CashierCashMovement |
| Shift Variance | `cash-shift-variance:${shift.id}` | CashierShift |
| POS Cash Movement (client) | `cashier-cash-movement:${user.sub}:${fingerprint}` | Per-operator |
| PPOB Transaction | `ppob:prepayment:${id}`, `ppob:fulfilled:${id}`, `ppob:refund:${id}` | DigitalServiceTransaction |
| Supervisor Grant | `randomUUID()` | Company+Branch+Operator+Action |

### Quality Gates

| Gate | Result |
|------|--------|
| `workflow:validate` | ✅ PASS |
| `validate:repo` | ✅ PASS |
| `lint` (6 workspaces) | ✅ PASS |
| `audit:p5:visual` | ✅ PASS |
| `build` (6 apps) | ✅ PASS |
| Dependency-free tests | ✅ 1818/1818 PASS |
| Financial safety tests | ✅ 6/6 PASS |

### Migration Plan

None. Existing `IdempotencyReceipt` persists cash movement retry receipts. No Prisma schema change or database migration.

### Rollback Plan

1. Rollback application code
2. Keep all `IdempotencyReceipt`/`CashierCashMovement`/`DigitalServiceTransaction` records immutable
3. Do not delete or rewrite historical finance facts

### Security Notes

- Tenant identity from trusted `AuthUser` companyId/branchId, not DTO
- PPOB 404 prevents cross-branch/user information leakage
- No live provider credential included

---

**Evidence Package Complete** ✅
**Status**: Ready for RELEASE_READY
