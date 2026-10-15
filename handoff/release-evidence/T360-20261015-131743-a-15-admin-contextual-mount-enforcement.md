# Release Evidence — T360-20261015-131743

**A-15 — UI audit proves handler presence, not workflow completeness.** Closed 2026-10-15.
Source commit `ef47455`.

## What was found at intake

A-15 was raised because the UI audit proves handler presence, not workflow completeness. It was
demonstrated by `R2HrConfiguration`, which was defined but never rendered, so `/people/attendance`
and `/people/compliance` both displayed the payroll lifecycle and all ten panels were unreachable
from every role while every gate stayed green. Presence in source is not a mounted workflow.

The gap was still live. `config/admin-contextual-workflow-map.json` claimed
`inventory-control/overview` was rendered by a component called `InventoryLedger`, and that
identifier appears in **no file in the repository**. The work shipped under `OperationsView` plus
an inline ledger section, and no gate noticed that the map named a component that was never
written. Same shape as `R2HrConfiguration`, found by the same method — which is the argument for
deriving the rule rather than writing a list of known-good names.

## What was changed

| File | Change |
| --- | --- |
| `scripts/lib/admin-contextual-mount.mjs` | New. Two checks derived from the map and the page: a renderer must appear as a JSX element in the page, and a subview must be bound as a mode by a callsite that mounts it |
| `scripts/audit-admin-contextual-workflows.mjs` | Both checks wired in; either one failing fails the audit |
| `config/admin-contextual-workflow-map.json` | `inventory-control/overview` corrected from `OperationsView:overview+InventoryLedger` to `OperationsView:overview` |
| `tests/admin-contextual-mount-enforcement.test.mjs` | New. 8 controls |

### Three shapes honoured rather than assumed away

A rule that assumed one shape proved nothing, so each is handled on its own terms:

- **Mode-less renderer** (`<ManufacturingView token={token} />`) — self-routing; the component
  owns its own view switching, so it is not asked for a mode union. Asking anyway would invent a
  contract the code does not have, which is how a gate learns to be ignored.
- **Dynamic mode** (`mode={activeDomainView?.key ?? 'payroll'}`) — treated as reachable, because
  the workspace drives the subview and neither `attendance` nor `compliance` is a literal at the
  callsite.
- **`commerceSection`** — folded into `commerce/<section>`, so the commerce rows resolve against
  the axis they actually bind rather than the coarse `mode="commerce"` above it.

The subview union is recomputed per row rather than cached per component. A cache would make the
verdict depend on row order, and a gate whose verdict depends on iteration order is not a gate.

## Evidence

| Evidence | Meaning |
| --- | --- |
| `source-commit:ef47455` | Commit carrying the gate, the wiring, the map correction and the controls |
| `logs_38684782158.zip` | Full Automated UAT run on that commit |
| `logs_38684782278.zip` | Full System Simulation run on that commit |
| `scripts/lib/admin-contextual-mount.mjs` | The derived rule |
| `tests/admin-contextual-mount-enforcement.test.mjs` | The controls, including the end-to-end wiring proof |
| `tests/hr-r2-configuration-reachability.test.mjs` | The original per-view control that names this failure class; still green |
| `config/admin-contextual-workflow-map.json` | The corrected map |
| `handoff/release-evidence/T360-20261015-131743-a-15-admin-contextual-mount-enforcement.md` | This document |

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| Mapped renderer is actually mounted, not merely named in source | Pass — derived JSX check |
| Mapped subview is bound as a mode by a callsite that mounts it | Pass — derived union check |
| The gate fails when a view is not reachable | Pass — controls 3, 4 and 7 |
| The rule is not defeated by a shape it does not expect | Pass — controls 5 and 6 cover mode-less and dynamic |
| Wiring into the audit is proven, not asserted | Pass — control 7 runs the real audit against a scratch copy carrying the phantom renderer and asserts it exits non-zero naming `InventoryLedger` |
| No regression to the per-view controls that raised this class | Pass — `hr-r2` 5/5 |

## Local verification

| Gate | Result |
| --- | --- |
| `node --test tests/admin-contextual-mount-enforcement.test.mjs` | 8/8 |
| `node --test tests/hr-r2-configuration-reachability.test.mjs` | 5/5 |
| `node scripts/audit-admin-contextual-workflows.mjs` | PASS — 70/70 contextual destinations, 14 workspaces |
| `npm run test:dependency-free` | **1875/1875**, up from 1867 |
| `npm run lint` | exit 0 |

## Product state

| Field | Value |
| --- | --- |
| `productReady` | `false` — unchanged |
| `humanStage20` | `PENDING` — unchanged |
| `currentPhase` | `P5` — unchanged |

Findings: **14 of 15 `RUNTIME_VERIFIED`**. The one remaining is `audit:A-07` (HIGH,
`IMPLEMENTED_RUNTIME_PENDING`): R7/F12 visual acceptance failed despite automated green. It is
the human gate and cannot be closed by code.

## What this does not claim

A-15 is closed because the *class* of defect is now enforced: a mapped view can no longer stop
mounting while every gate stays green. It does not claim the 70 contextual workflows are
*correct* at runtime — that is browser and human evidence, and it does not claim A-07. It does
not touch business logic, permissions, tenant or branch authority, schema or any runtime path.
