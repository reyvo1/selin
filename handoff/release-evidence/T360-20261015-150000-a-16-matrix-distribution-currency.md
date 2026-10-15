# Release Evidence — T360-20261015-150000

**A-16 — the status-doc currency guard enforces a curated phrasing list, so a matrix distribution claim that uses no curated wording is not checked.** Closed 2026-10-15.

## What was found at intake

A-14 closed on 2026-10-14 with `tests/status-doc-currency.test.mjs`, which fails a governance document that asserts an undated live count. Its rule is the `LIVE_CLAIM` regex: *currently holds*, *currently reports*, *now reports*, *current count is*, *the current count*, *live counts are*, *current figures are*. A generic number scan was measured at the time and rejected because it over-flagged dated records, so the curated list was the right call then, and its closing notes recorded the limitation plainly: *"Extend the list only when a new undated claim is measured."*

The limitation materialised. During the A-13/A-15 session, four governance documents came to assert a status distribution that does not match the matrix:

| Location | Asserted | Matrix holds |
| --- | --- | --- |
| `docs/PROJECT-STATE.md` (A-14 block) | `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` | `17`, `1` |
| `docs/PROJECT-STATE.md` (A-15 block) | `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` | `17`, `1` |
| `handoff/CURRENT-WORK.md` (A-13/A-15 block) | `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` | `17`, `1` |
| `handoff/CURRENT-WORK.md` (A-14 block) | `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` | `17`, `1` |
| `handoff/CURRENT-WORK.md` (W-01 block) | `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` | `17`, `1` |

The prose used no `LIVE_CLAIM` wording, so every gate stayed green — local and CI, through five commits and three workflows. `git show` across those commits confirms `config/product-completeness.json` never held 16 or 2 for the feature matrix; the counts were simply wrong when written. The distribution was copied forward between handoff blocks, so one error propagated into five places.

This is the same class as A-14 and the same argument as A-15: a rule that is a list of known-good names fails on the first name nobody thought of.

## What was changed

| File | Change |
| --- | --- |
| `tests/status-doc-currency.test.mjs` | New derived rule `matrixDistributionErrors` plus `actualMatrixCounts`; three new controls; `scannedFiles` now skips `handoff/generated/` |
| `docs/PROJECT-STATE.md` | Two distribution claims corrected to `17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED` |
| `handoff/CURRENT-WORK.md` | Three distribution claims corrected to `17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED` |

### The rule is derived, not curated

A distribution claim is **any sentence that names two or more canonical status tokens**. Inside such a sentence, every `N STATUS` must equal the count in `config/product-completeness.json` — from `features` or from `postAuditFindings`, both authoritative. The tokens and the counts are read from the matrix, so there is no phrasing to curate and no name to forget. A future status token is picked up by reading the file, not by editing a regex.

A bare `N STATUS` is deliberately **not** checked, for two measured reasons:

- **Sequence false positive.** `27 FOUNDATION, 3 PARTIAL` — a naive matcher reads `3` as FOUNDATION's count. The sentence-level requirement is what prevents this; the tokens after each count belong to the counts before them.
- **Phase designator.** `## 2026-09-26 — P2 RUNTIME_VERIFIED` and `` `P5 IMPLEMENTED_RUNTIME_PENDING` `` carry no count at all. Neither sits in a sentence naming a second status token, so both drop out.

Measured on the pre-fix corpus: the naive `N STATUS` form produced **10 hits**, one of which was a
phase designator. The sentence-scoped form produced **9 hits with none** — and all 9 were the
defect above. The rule was run against the documents *before* they were corrected, so it is proven
red on the real defect, not on a synthetic case.

### `handoff/generated/` is out of scope

`scannedFiles` skipped `release-evidence` and now skips `generated`. These files are derived from the same source on each run and cannot drift independently; counting them would report one defect under two filenames, which trains a reader to ignore the report.

## Evidence

| Evidence | Meaning |
| --- | --- |
| `tests/status-doc-currency.test.mjs` | The derived rule and its controls |
| `docs/PROJECT-STATE.md` | Corrected distribution claims |
| `handoff/CURRENT-WORK.md` | Corrected distribution claims |
| `config/product-completeness.json` | Unchanged — the authority the rule reads |
| `handoff/release-evidence/T360-20261015-150000-a-16-matrix-distribution-currency.md` | This document |

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| A wrong distribution fails the guard regardless of wording | Pass — the shipped phrasing `16 IMPLEMENTED_RUNTIME_PENDING, 2 RUNTIME_VERIFIED` is a control case |
| The corrected counts pass | Pass — positive control uses the live matrix counts |
| Phase designators are not flagged | Pass — `P2 RUNTIME_VERIFIED` and `P5 IMPLEMENTED_RUNTIME_PENDING` are control cases |
| Single-token mentions are not flagged | Pass — `- A-07 remains \`IMPLEMENTED_RUNTIME_PENDING\`.` is a control case |
| The rule was red on the real defect before the fix | Pass — 9 offenders named, all the shipped defect |
| No residual wrong count outside generated files | Pass — `grep` over `docs/` and `handoff/` returns nothing |
| `productReady`, `currentPhase`, `humanStage20` untouched | Pass |

## Local verification

| Gate | Result |
| --- | --- |
| `node --test tests/status-doc-currency.test.mjs` | 7/7, up from 4 |
| `npm run test:dependency-free` | **1878/1878**, up from 1875 |
| `npm run lint` | exit 0 |
| `npm run workflow:validate` | 55 work items, 8 waves |
| `npm run validate:repo` | 1228 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS (7 audits) |

## Product state

| Field | Value |
| --- | --- |
| `productReady` | `false` — unchanged |
| `humanStage20` | `PENDING` — unchanged |
| `currentPhase` | `P5` — unchanged |

Findings: **15 of 16 `RUNTIME_VERIFIED`**. The one remaining is `audit:A-07` (HIGH,
`IMPLEMENTED_RUNTIME_PENDING`): R7/F12 visual acceptance failed despite automated green. It is
the human gate and cannot be closed by code.

## What this does not claim

A-16 is closed because the *class* of defect is now enforced: a governance document can no longer
assert a status distribution that disagrees with the matrix while every gate stays green. It does
not claim the corrected counts are *correct* at runtime — that is browser and human evidence, and
it does not claim A-07. It does not touch business logic, permissions, tenant or branch authority,
schema or any runtime path. The five corrected lines are the only prose changed.
