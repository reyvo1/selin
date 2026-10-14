# Release Evidence — T360-20261014-131512

A-14 — stop governance documents stating undated live counts that silently lag the evidence.

## Why this item exists

`audit:A-14` was raised because status documents conflict with, or lag, the machine evidence.
Measured on 2026-10-14: seven prose lines across five governance documents carried numbers that
were true when written and stale at the next commit, and two more claimed the working copy had
no `.git` while the repository does. Every number a reader trusts from prose was already wrong
by the time they read it.

## Measured defect

| File | Line | Stale claim |
| --- | --- | --- |
| `STATUS-FINAL.md` | 3 | "`work-items/active/` currently holds **4 work items** (3 VERIFICATION, 1 BLOCKED)"; "the current count is 1089"; "carries no `.git`" |
| `docs/PROJECT-STATE.md` | 3 | "currently **36 controllers / 454 API handlers / 180 Prisma models / 63 contextual destinations / 420 interactive controls**, with **1089/1089** dependency-free tests" |
| `docs/PROJECT-STATE.md` | 5 | "This copy has no `.git`" |
| `docs/PROJECT-STATE.md` | 246 | "the current figures are 1021 files, 454 API handlers, 420 controls, 1089 dependency-free tests" |
| `docs/F12-FINAL-UI-UX-COMPLETION.md` | 31 | "The current count is 1021 files" |
| `docs/COMPLETION-DOCS-INDEX.md` | 34 | "It now reports 454 routes, payroll 30, platform 41" |
| `docs/COMPLETION-DOCS-INDEX.md` | 38 | "It now reports 454 routes and 420 controls" |
| `docs/COMPLETION-DOCS-INDEX.md` | 14 | "Current source audit reports 509 API handlers, 195 Prisma models and 65 contextual destinations. This copy has no `.git`" |
| `docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md` | 83 | "currently reports 63/63" |

The counting rule in `docs/PROJECT-STATE.md` was itself the worst offender: it announced the
canonical counting rule and then broke it in the same sentence.

## Business rule

Counts belong to machines. A document may name the command or file that regenerates a number,
and may record a number that is explicitly dated as a historical fact; it may not assert an
undated current value.

## Changes

| File | Change |
| --- | --- |
| `STATUS-FINAL.md` | Header no longer claims 4 active work items, 1089 tests, or that the tree lacks `.git`; points at `npm run workflow:status`, `npm run test:dependency-free`, `git log` |
| `docs/PROJECT-STATE.md` | Counting rule rewritten to name the regenerating commands and to never state a current value; the `.git` claim becomes a historical note with a verification instruction; the V4.9 parenthetical drops its live figures |
| `docs/F12-FINAL-UI-UX-COMPLETION.md` | "The current count is 1021 files" → points at `npm run validate:repo` |
| `docs/COMPLETION-DOCS-INDEX.md` | Both "now reports" lines and the "current source audit reports … This copy has no `.git`" block replaced with regeneration commands and a verification instruction |
| `docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md` | "currently reports 63/63" dropped; the fail-closed authority already prints the value |
| `tests/status-doc-currency.test.mjs` (new) | 4 controls |

## The guard, deliberately narrow

`LIVE_CLAIM` is a **curated** list of phrasings that only ever appear as undated current-value
claims:

```
currently holds | currently reports N | now reports N | current count is
| the current count | live counts are|is | current figures are
```

A line trips the guard only when one of those phrasings appears beside a digit. A generic
number scan was measured and rejected: it flagged 10 lines, three of which were dated records
or harmless prose (`sekarang mempunyai canonical workspace routes …` with a route count later
in the line). The curated list flags exactly the seven real defects plus the two `.git` claims,
and nothing else. A dated sentence — "as of 2026-10-14, 918 files" — renders, because a dated
number is a record, not a claim.

`MISSING_GIT_CLAIM` separately rejects "this copy has no `.git`" and "carries no `.git`", which
is false in this repository and was repeated in three files.

## Acceptance criteria → evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | No live-claim line with a digit in scoped docs; the measured lines rewritten to commands | zero offenders from the repo-wide scan in the guard test |
| 2 | `tests/status-doc-currency.test.mjs` fails on a reintroduced claim and passes today | 4 tests pass; synthetic positives "It now reports 454 routes." and "The current count is 1021 files." each return one hit |
| 3 | The rule stays narrow: dated records still render | synthetic negatives for a dated count, an "at the time of this wave" record and a command pointer all return zero |
| 4 | `STATUS-FINAL.md` no longer asserts 4 items, 1089 tests, or no `.git` | rewritten header |
| 5 | Legacy docs still name `config/product-completeness.json` as status authority | `tests/product-completeness-p0.test.mjs` unchanged and green |
| 6 | All three workflows green on the exact commit | below |

## Verification basis — exact commit `b2f96bc`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38572274826` | success (28s) |
| Toko360 Full Automated UAT | `38572274675` | success (8m05s) |
| Toko360 Full System Simulation | `38572274795` | success (8m06s) |

Both heavy workflows run the dependency-free suite, which includes the currency guard, then
`audit:full:repo` and the aggregate `ci:summary:github:assert`.

## Local gates

| Command | Result |
| --- | --- |
| `node --test tests/status-doc-currency.test.mjs` | **4/4 PASS** |
| `npm run test:dependency-free` | **1859/1859 PASS** (was 1855; +4 new) |
| `npm run lint` | PASS |
| `npm run workflow:validate` | PASS, 51 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1215 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS, 7 audits |

## Findings state after this change

`audit:A-14` (MEDIUM) → `RUNTIME_VERIFIED`. Open findings drop from 4 to **3**:
A-07 (HIGH, needs human Stage-20 acceptance), A-13, A-15 (MEDIUM).

## Not claimed

- `productReady` remains `false`, `currentPhase` remains `P5`, `humanStage20` remains `PENDING`.
- The curated list is a closed vocabulary, not a language model: a new undated claim written in
  words outside the list would not trip the guard. The list is extended whenever a new phrasing
  is measured, as it was extended to cover `currently reports N` from the master workflow document.
- No business logic, API contract, permission, tenant/branch authority, schema or runtime path
  changed; no assertion was weakened.
