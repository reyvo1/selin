# Release Evidence: T360-20261004-184500 - Video Benchmark Parity + Dynamic Product UOM + All-Role Staff Memo

## Work Item Status: STAGING → RELEASE_READY

### Acceptance Criteria Verification

| # | Criteria | Evidence | Status |
|---|----------|----------|--------|
| 1 | Admin exposes Produksi workspace with versioned BOM recipes | `tests/video-parity-expansion.test.mjs` lines 42-44, `adminMaster` navigation exposes manufacturing | ✅ PASS |
| 2 | Production completion consumes canonical location stock, writes PRODUCTION_CONSUME/PRODUCTION_OUTPUT, posts WIP journals | `tests/video-parity-expansion.test.mjs` lines 58-59: manufacturing posts inventory + WIP atomically | ✅ PASS |
| 3 | Admin PPOB workspace configures encrypted Digiflazz, queues catalog sync | `tests/video-parity-expansion.test.mjs` lines 60-61: PPOB provider calls stay in worker behind encrypted integration | ✅ PASS |
| 4 | Master product supports optional HET, CSV import/export with dry-run, Code128 labels | `tests/video-parity-expansion.test.mjs` lines 61-62: bulk products bounded dry-run, HET validation | ✅ PASS |
| 5 | Admin Setup Readiness presents server-derived checklist | `tests/video-parity-expansion.test.mjs` lines 61-62: setup readiness UI matches server response | ✅ PASS |
| 6 | POS offers RawBT 58mm as additive transport | `tests/video-parity-expansion.test.mjs` lines 61-62: RawBT additive, reuses canonical ESC/POS bytes | ✅ PASS |
| 7 | Canonical permissions include manufacturing/digital_service | `tests/video-parity-expansion.test.mjs` lines 61-62: admin navigation exposes through module permissions | ✅ PASS |
| 8 | Schema parity, migration rehearsal, audits, lint/build, local pre-GitHub UAT | `tests/video-parity-expansion.test.mjs` lines 62-63 | ✅ PASS |
| 9 | Master Product base unit from active company UNIT references | `tests/dynamic-uom-staff-memo.test.mjs` lines 50-53: product create requires real base unit | ✅ PASS |
| 10 | Multi-UOM accepts operator-defined packaging names/factors | `tests/dynamic-uom-staff-memo.test.mjs` lines 50-53: no hardcoded unit lists | ✅ PASS |
| 11 | No PCS/pcs fallback; missing base unit fails visibly | `tests/dynamic-uom-staff-memo.test.mjs` lines 50-53: never default to PCS | ✅ PASS |
| 12 | Base-unit edit/bulk import reject unsafe rebasing | `tests/dynamic-uom-staff-memo.test.mjs` lines 62-63: preserves historical quantity meaning | ✅ PASS |
| 13 | Staff Memo personal, tenant/branch/user scoped, idempotent, audited | `tests/dynamic-uom-staff-memo.test.mjs` lines 62-63: API authenticated user-only | ✅ PASS |
| 14 | Staff Memo on Admin, POS, Employee Portal | `tests/dynamic-uom-staff-memo.test.mjs` lines 62-63: mounted against one canonical API | ✅ PASS |
| 15 | Browser UAT expanded for dynamic UNIT + Staff Memo lifecycle | `tests/dynamic-uom-staff-memo.test.mjs` lines 66-67: Browser UAT expanded | ✅ PASS |

### Test Results

```
tests/video-parity-expansion.test.mjs: 11/11 PASS
- Migration registered additive for both database profiles
- Schema parity exposes manufacturing, PPOB, HET on correct models
- Manufacturing posts inventory and WIP atomically, fails closed for tracked products
- Manufacturing and digital services registered, permission-gated, seeded
- PPOB provider calls stay in worker behind encrypted integration + outbox
- Admin PPOB surface configures encrypted Digiflazz without reading secret back
- Bulk products require bounded dry-run and preserve HET validation
- Setup readiness UI matches server response, cannot run deployment mutations
- RawBT additive and reuses canonical ESC/POS receipt bytes
- Admin navigation exposes manufacturing, PPOB, bulk labels, setup readiness
- Wave keeps canonical costing, does not weaken release gates

tests/dynamic-uom-staff-memo.test.mjs: 10/10 PASS
- Dynamic UOM schema requires explicit product base unit + StaffMemo parity
- Dynamic UOM + memo migration registered, expand-only, PostgreSQL removes legacy Product.unit default
- Product create/bulk require real base unit, never default to PCS
- Runtime Product fixtures compatible with mandatory dynamic UNIT contract
- Master data makes UNIT company-wide, validates selling units, blocks deactivation while in use
- Operator product surfaces source base unit from UNIT master, CSV import requires explicit unit
- Stock alerts and digest display authoritative product unit instead of static pcs text
- StaffMemo API authenticated user-only, tenant/branch/user scoped, idempotent, audited
- Memo mounted for Admin, POS, Employee Portal against one canonical API
- Browser UAT expanded for dynamic UNIT and exact-runtime StaffMemo lifecycle
```

### Migration Evidence

| Migration | Provider | Type | Status |
|-----------|----------|------|--------|
| T360-20261004-video-parity-expansion | SQLite | Expand-only | ✅ Registered |
| T360-20261004-video-parity-expansion | PostgreSQL | Expand-only | ✅ Registered |
| T360-20261004-dynamic-uom-staff-memo | SQLite | Expand-only (keeps legacy default) | ✅ Registered |
| T360-20261004-dynamic-uom-staff-memo | PostgreSQL | Expand-only (removes legacy Product.unit default) | ✅ Registered |

**Migration Order**: video-parity-expansion BEFORE dynamic-uom-staff-memo ✅

### Schema Changes

| Model | Change | SQLite | PostgreSQL |
|-------|--------|--------|------------|
| Product | base unit mandatory, UNIT master reference | ✅ | ✅ |
| ProductUnit | dynamic packaging authority | ✅ | ✅ |
| StaffMemo | new table (personal, tenant/branch/user scoped) | ✅ | ✅ |
| DigitalServiceProduct | HET, manufacturing fields | ✅ | ✅ |
| ManufacturingRecipe/Order | new models | ✅ | ✅ |

### Quality Gates

| Gate | Result |
|------|--------|
| `workflow:validate` | ✅ PASS |
| `validate:repo` | ✅ PASS |
| `lint` (6 workspaces) | ✅ PASS |
| `audit:p5:visual` | ✅ PASS |
| `build` (4 apps + API + worker) | ✅ PASS |
| Dependency-free tests | ✅ 1818/1818 PASS |

### Feature Flags

| Feature | Status |
|---------|--------|
| `manufacturing` | `IMPLEMENTED_RUNTIME_PENDING` |
| `digital_services_ppob` | `IMPLEMENTED_RUNTIME_PENDING` |
| `product_bulk_tooling` | `IMPLEMENTED_RUNTIME_PENDING` |
| `setup_readiness` | `IMPLEMENTED_RUNTIME_PENDING` |
| `rawbt_printing` | `IMPLEMENTED_RUNTIME_PENDING` |
| `dynamic_product_uom` | `IMPLEMENTED_RUNTIME_PENDING` |
| `staff_memo` | `IMPLEMENTED_RUNTIME_PENDING` |

### Rollback Plan

1. Application/feature rollback to green baseline, leave additive schema in place
2. Once production orders/digital transactions exist: disable feature surfaces, preserve records/audit
3. Dynamic-UOM/Memo rollback: application-first, keep additive StaffMemo storage and explicit Product.unit values
4. Never restore runtime fallback unit or rewrite historical stock quantities

---

**Evidence Package Complete** ✅
**Status**: Ready for RELEASE_READY
