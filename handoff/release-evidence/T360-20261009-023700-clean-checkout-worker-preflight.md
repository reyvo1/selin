# Release Evidence: T360-20261009-023700 - Clean-Checkout Worker Preflight & Isolated TypeScript Regression

## Work Item Status: STAGING → RELEASE_READY

### Acceptance Criteria Verification

| # | Criteria | Evidence | Status |
|---|----------|----------|--------|
| 1 | `ci:preflight:local` generates SQLite Prisma → builds worker → runs complete test suite | `package.json` script: `npm run workflow:validate && npm run validate:repo && npm run db:local:generate && npm run build -w @toko360/worker && npm run test:dependency-free` | ✅ PASS |
| 2 | Telegram wire suite imports real compiled worker module | `tests/post1c-telegram-polling.test.mjs` imports `../apps/worker/dist/telegram-polling.js` | ✅ PASS |
| 3 | Clean-checkout worker typecheck runs without apps/api/dist, no rename/mutate shared artifacts | `tests/worker-dist-import-runtime.test.mjs` uses `mkdtempSync` + `--noEmit`, no `fs.renameSync` | ✅ PASS |
| 4 | Previous 1706/1708 baseline failures resolved without weakening UAT | All tests PASS, no gate weakened | ✅ PASS |

### Test Results

```
tests/ci-preflight-worker-build-order.test.mjs: 3/3 PASS
- ci:preflight:local generates SQLite Prisma → builds worker → runs complete test suite
- Telegram wire suite imports real compiled worker module
- Clean-checkout worker typecheck does not rename shared API build artifacts

tests/quality-fast-sqlite-prepare-order.test.mjs: 3/3 PASS
- quality:fast prepares SQLite before npm test
- quality:fast builds worker BEFORE npm test
- quality:full and quality:fast don't prep SQLite twice

tests/post1c-telegram-polling.test.mjs: PASS (imports compiled worker)
tests/worker-dist-import-runtime.test.mjs: PASS (isolated typecheck)
```

### Script Changes

| Script | Before | After |
|--------|--------|-------|
| `ci:preflight:local` | Missing worker build step | `workflow:validate → validate:repo → db:local:generate → build -w @toko360/worker → test:dependency-free` |
| `quality:fast` | Worker build after test | Worker build BEFORE test |

### Key Fixes

1. **Worker build order**: Worker now compiles BEFORE full test suite runs (required for Telegram wire test)
2. **Isolated typecheck**: Worker typecheck uses temporary directory + `--noEmit`, never touches shared `apps/api/dist`
3. **Telegram wire test**: Imports real compiled `apps/worker/dist/telegram-polling.js` for HTTP assertions
4. **SQLite Prisma generation**: Explicit `db:local:generate` before worker build

### Quality Gates

| Gate | Result |
|------|--------|
| `workflow:validate` | ✅ PASS |
| `validate:repo` | ✅ PASS |
| `lint` (6 workspaces) | ✅ PASS |
| `audit:p5:visual` | ✅ PASS |
| `build` (6 apps) | ✅ PASS |
| Dependency-free tests | ✅ 1818/1818 PASS |
| `ci:preflight:local` steps | ✅ PASS |
| Telegram wire test | ✅ PASS |
| Worker isolated typecheck | ✅ PASS |

### Migration Plan

No database/schema changes. Compile-order and isolated test fixture correction only.

### Rollback Plan

Revert `package.json` preflight command + two test files + regression contract. Do not touch data, history, or previously staged financial-hardening changes.

---

**Evidence Package Complete** ✅
**Status**: Ready for RELEASE_READY
