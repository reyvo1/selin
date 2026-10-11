# Release Evidence — T360-20261012-011530

Restore green GitHub UAT after work item closure.

## Trigger

`main` was red on both PostgreSQL GitHub workflows at commit `0230b58`.

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Toko360 Full Automated UAT | `38086561199` | failure |
| Toko360 Full System Simulation | `38086561205` | failure |
| Workflow Governance | `38086561153` | success |

The failing UAT job reported roughly 30 red steps. That list is cascade, not diagnosis. The single
first blocker was `STEP_BUILD`:

```
Build gate FAIL — REGRESSION_TESTS gagal dengan exit code 1
# tests 1805
# pass 1802
# fail 3
```

## Diagnosis

`not ok` lines in `gh api .../actions/jobs/<id>/logs`:

```
not ok 143  - tests/p6a-retail-transaction-completion.test.mjs
not ok 203  - tests/recovery-r0-48-finding-coverage.test.mjs
not ok 1760 - wave explicitly keeps canonical costing and does not weaken release gates
```

with, for example:

```
Error: ENOENT: no such file or directory, open
  '/home/runner/work/selin/selin/work-items/active/T360-20261005-154000-p6a-retail-transaction-completion.json'
```

Cause chain:

1. `6715f1c` advanced nine work items to `STAGING`. Three tests asserted
   `phase === 'VERIFICATION'`, so they turned red immediately (runs `38085658748` / `38085658754`,
   which failed for this same reason).
2. `0230b58` moved the same nine JSON files from `work-items/active/` to `work-items/completed/`
   with `phase: CLOSED`. The same three tests then failed earlier, at file resolution.
3. Because the build gate runs `npm test`, three test-file failures aborted `SIX_APP_PRODUCTION_BUILD`,
   which removed the artifact. Every artifact-dependent step downstream therefore failed, including
   the Stage-20 automated readiness gate and the UAT candidate fail-closed assertion.

Second, independent defect found while repairing the first: those nine work items recorded
`releaseEvidence` as a single string naming `handoff/release-evidence/<id>.md`, but the committed
evidence files are named `<id>-<slug>.md`, and every other work item in the repository stores
`releaseEvidence` as an array. So even a corrected path assertion would have been asserting a
pointer that does not resolve.

Third observation, deliberately **not** "fixed": the Stage-20 log also shows
`PrismaClientInitializationError: the URL must start with the protocol file:` from
`scripts/apply-stage20-critical-indexes.mjs`. That is a consequence of the build gate aborting before
`PRISMA_GENERATE_POSTGRES_FINAL`; the generated client was still the SQLite one from
`SQLITE_DB_PREPARE`. No separate change was made for it.

## Repair — commit `56cbd9c`

- `tests/helpers/work-item.mjs` (new): `resolveWorkItemPath` / `readWorkItem` resolve a work item
  from `work-items/active/` or `work-items/completed/`, fail closed when it is in neither, and fail
  closed when the same filename exists in both.
- `assertDeliveredWorkItem` (new, same helper) replaces the hardcoded `phase === 'VERIFICATION'`
  equality and is strictly stronger: it requires a delivered phase (`RELEASE_READY | RELEASED |
  CLOSED`), `releasedAt`, `closedAt`, and at least one `releaseEvidence` entry under
  `handoff/release-evidence/` that exists on disk.
- `tests/work-item-path-resolution.test.mjs` (new): scans every `tests/*.test.mjs` for
  `work-items/{active,completed}/<file>.json` literals and fails if any resolves to no real work
  item, so a future closure cannot silently break the suite.
- Nine work items in `work-items/completed/` corrected to the repository's array convention naming
  the evidence file that actually exists.

## Evidence — local

| Gate | Result |
| --- | --- |
| `node --test` on the 4 work-item files | 29/29 PASS |
| `npm run test:dependency-free` | 1821/1821 PASS |
| `npm run workflow:validate` | PASS, 46 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1192 files, 202 Prisma models |
| `npm run lint` | PASS, all workspaces |

## Evidence — GitHub, exact commit `56cbd9c`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Toko360 Full Automated UAT | `38158942702` | **success** |
| Toko360 Full System Simulation | `38158942550` | **success** |
| Workflow Governance | `38158942509` | **success** |

`STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING`, `Automated UAT PASS.`

## Not claimed

Human Stage-20 remains `PENDING`. P5 remains `IMPLEMENTED_RUNTIME_PENDING`, `productReady=false`.
R8 (`T360-20260925-143000`) remains `BLOCKED`. This evidence covers only the CI repair; it advances
nothing in canonical product readiness.