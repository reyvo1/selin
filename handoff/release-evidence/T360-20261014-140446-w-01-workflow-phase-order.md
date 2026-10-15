# Release Evidence — T360-20261014-140446

W-01 — `workflow:advance` must not skip a phase.

## Why this item exists

Found while closing `T360-20261014-131512` (A-14). `commandAdvance` only rejected a
transition whose order was *lower* than the current one:

```js
if (phase !== 'BLOCKED' && nextOrder < currentOrder) fail('...');
```

An item at `STAGING` (5) could therefore jump directly to `RELEASED` (7), skipping
`RELEASE_READY` (6) and the `releaseEvidence` check that lives there. That is exactly what
happened: A-14 went `STAGING → RELEASED → CLOSED`, and its `releaseEvidence` array had to be
backfilled after the fact.

Same class as A-02: a gate that can be bypassed by skipping the step that would have enforced
it is not a gate.

## Changes

| File | Change |
| --- | --- |
| `scripts/workflow.mjs` | `commandAdvance` now derives the rule from `config/workflow-policy.json` `phaseOrder`: a non-`BLOCKED` advance must land on the **immediate successor** (`nextOrder === currentOrder + 1`). `BLOCKED` stays reachable from any phase and stays a dead end. The error names the phase that was skipped over |
| `tests/workflow-phase-order.test.mjs` (new) | 2 controls |

## What is enforced

| Transition | Result |
| --- | --- |
| `STAGING → RELEASED` | rejected, error names `RELEASE_READY` |
| `STAGING → RELEASE_READY` with empty `releaseEvidence` | rejected, error names `releaseEvidence` |
| `STAGING → RELEASE_READY` with a resolvable evidence file | accepted |
| `RELEASE_READY → STAGING` | rejected (backward) |
| any phase → `BLOCKED` | accepted |
| `BLOCKED → any phase` | rejected (dead end, matches documented manual path) |
| `INTAKE → ANALYSIS → … → CLOSED` (single steps) | accepted |

The test drives the real CLI against a scratch copy of the repository so no committed work
item is mutated.

## Acceptance criteria → evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | `workflow:advance` rejects a non-`BLOCKED` transition that is not the immediate successor | `scripts/workflow.mjs` rule; first assertion in the test |
| 2 | Single-step advance and entering `BLOCKED` still work | test: `RELEASE_READY` succeeds once evidence resolves; `STAGING → BLOCKED` succeeds |
| 3 | Dependency-free test proves the negative and positive cases | `tests/workflow-phase-order.test.mjs` (2/2 PASS) |
| 4 | `RELEASE_READY` still requires `releaseEvidence`; every path to `CLOSED` now passes through it | rule + test |
| 5 | All three workflows green on the exact commit | below |

## Verification basis — exact commit `25183b4`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38579364606` | success |
| Toko360 Full Automated UAT | `38579364527` | success |
| Toko360 Full System Simulation | `38579364562` | success |

## Local gates

| Command | Result |
| --- | --- |
| `node --test tests/workflow-phase-order.test.mjs` | **2/2 PASS** |
| `npm run test:dependency-free` | **1861/1861 PASS** (was 1859; +2 new) |
| `npm run lint` | PASS |
| `npm run workflow:validate` | PASS, 52 work items, 8 delivery waves |
| `npm run validate:repo` | PASS |
| `npm run audit:full:repo` | PASS, 7 audits |

## Not claimed

- `productReady` remains `false`, `currentPhase` remains `P5`, `humanStage20` remains `PENDING`.
- `BLOCKED → <phase>` is still a dead end via the CLI; the documented manual path (new work
  item or hand-edit with a note) is unchanged. A future item may add an explicit `--from-blocked`
  resume if operator experience shows it is needed.
- Process integrity only: no business logic, schema, permission, tenant or runtime path changed.
