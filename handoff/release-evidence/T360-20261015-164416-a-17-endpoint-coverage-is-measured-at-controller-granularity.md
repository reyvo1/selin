# Release Evidence — T360-20261015-164416

**A-17 — endpoint coverage is measured at controller granularity, so an unreachable endpoint hides behind a reachable sibling.** Closed 2026-10-15.

## What was found at intake

`config/f1-backend-ui-audit.json` answers one question per controller: *is any route of this
controller called by a UI app?* It builds `routeStrings.some(...)` over the controller's routes and
compares them to the UI's callsites with a raw `.includes()`. The answer is then written as a single
label plus a `uiApps` list.

Run today, it reports **45 of 46 controllers as `EXPOSED_OR_PARTIAL`**, each with at least one app
name, and `apps/api/src/extensions/edge-sync.controller.ts` as the only `HIDDEN_OR_API_ONLY`. That
verdict is **not false**. It is too coarse to be a gate: it cannot name *which* endpoint is missing,
so a controller with one unreachable endpoint and thirty reachable ones is indistinguishable from a
controller that is fully wired. Nothing between intake and release could have caught the difference.

| Controller (the 9 MIXED, plus edge-sync) | F1 verdict | F1 `uiApps` | Endpoints actually reached |
| --- | --- | --- | --- |
| `attendance/attendance.controller.ts` | `EXPOSED_OR_PARTIAL` | admin, employee-portal | 24 / 25 |
| `branch-continuity/branch-continuity.controller.ts` | `EXPOSED_OR_PARTIAL` | admin | 3 / 15 |
| `branch-continuity/branch-transfer.controller.ts` | `EXPOSED_OR_PARTIAL` | admin | 3 / 5 |
| `branch-sync/branch-sync.controller.ts` | `EXPOSED_OR_PARTIAL` | admin | 11 / 20 |
| `digital-services/digital-services.controller.ts` | `EXPOSED_OR_PARTIAL` | admin, pos | 8 / 9 |
| `extensions/extensions.controller.ts` | `EXPOSED_OR_PARTIAL` | admin, pos | 56 / 58 |
| `mobile-ops/mobile-ops.controller.ts` | `EXPOSED_OR_PARTIAL` | admin, pos | 7 / 10 |
| `payments/payments.controller.ts` | `EXPOSED_OR_PARTIAL` | admin | 1 / 2 |
| `platform/platform.controller.ts` | `EXPOSED_OR_PARTIAL` | admin, pos, storefront, employee-portal | 39 / 42 |
| `extensions/edge-sync.controller.ts` | `HIDDEN_OR_API_ONLY` | — | 0 / 3 |

Every one of the 34 unreachable endpoints below sits inside a controller that row reports as
`EXPOSED_OR_PARTIAL`.

## What was measured

| Measure | Value |
| --- | --- |
| Controllers | **46** — 36 `ALL_REACHED`, 9 `MIXED`, 1 `NONE_REACHED` |
| Routes | **532** across **428** distinct paths |
| Reachable | **495** |
| Unreachable | **37** |
| Flagged (unreachable **with** a reachable sibling) | **34** |
| UI source scanned | 495 path tokens across 2818 lines, from `apps/admin`, `apps/pos`, `apps/storefront`, `apps/employee-portal` and `apps/customer-mobile` |

`npm run audit:full:repo` runs `scripts/audit-full-repository.mjs` first and it independently reports
**532 API handlers**. Two counts derived by different code from the same tree agree, which is the
cheapest corroboration available for a number this load-bearing.

The 3 unreachable routes that are **not** flagged are the three on `edge-sync.controller.ts`: no
sibling on that controller is reached, so there is nothing to compare against. An API-only surface
is intentional and flags nothing — that is a design decision, not an omission, and treating it as a
gap would produce three permanent false alarms.

## The 34, classified

| Class | n | What it means |
| --- | --- | --- |
| `NODE_PROTOCOL` | **22** | The counterparty is a node, an edge device or `apps/worker`, none of which are in this repository |
| `UI_GAP` | **8** | Human-facing, guarded, and genuinely not wired. **Open work, not an exception** |
| `SUPERSEDED` | **2** | No caller anywhere; its data already reaches the screen through another endpoint |
| `DEVICE_INGEST` | **1** | Posted by a device adapter, not by a person |
| `PROVIDER_CALLBACK` | **1** | Public webhook a payment provider calls; a browser cannot originate it |

The 8 `UI_GAP` entries, each sitting beside a sibling the Admin UI *does* call:

| Endpoint | Controller | Guard | Reachable sibling that proves the screen is live |
| --- | --- | --- | --- |
| `GET /branch-transfer/transfers/:transferId` | branch-transfer | `integration.manage` | `POST .../arrival`, `POST .../abandon`, `GET /branch-transfer/pending` |
| `POST /branch-transfer/transfers/:transferId/departure` | branch-transfer | `integration.manage` | same three |
| `GET /digital-services/transactions/:id` | digital-services | SUPER_ADMIN, OWNER, ADMIN, CASHIER | `POST .../:id/settle`, `POST .../:id/refund`, `POST .../:id/recheck` |
| `POST /devices/:id/offline-transactions` | extensions | SUPER_ADMIN, OWNER, ADMIN | `POST .../offline-transactions/:transactionId/requeue` |
| `GET /platform/automation-jobs/:id` | platform | SUPER_ADMIN, OWNER, ADMIN, AUDITOR | `GET /platform/automation-jobs`, `POST .../:id/cancel`, `POST .../:id/replay` |
| `POST /mobile-ops/drafts/:draftId/scan` | mobile-ops | `inventory.opname` | `POST /mobile-ops/drafts/open`, `GET /mobile-ops/drafts/:draftId` |
| `POST /mobile-ops/drafts/:draftId/submit` | mobile-ops | `inventory.opname` | same two |
| `POST /mobile-ops/drafts/:draftId/discard` | mobile-ops | `inventory.opname` | same two |

In every row the surrounding workflow is open and in use — settle and refund work, the opname draft
opens and its discrepancy renders — while one step of it is unreachable. That is exactly the shape
the controller-granularity verdict cannot see.

`NODE_PROTOCOL` is justified by evidence rather than by assertion. `branch-sync` flags
`heartbeat`, `events`, `pull`, `publish`, `receive`, `failures`, `aggregates/.../version`,
`conflicts/:eventId` and `bootstrap` — all node-initiated **writes** — while the 11 reachable routes
on that controller are the observational admin reads (`nodes`, `peers`, `health`, `dead-letters`,
`conflicts`, `recovery-plan`). `branch-continuity` flags the 12 node policy, permit, watermark,
connectivity, discover, backup and rejoin routes beside the 3 admin reads of `capabilities` and
`consolidated`. `apps/worker` was read to confirm the claim: it reaches the Telegram and Digiflazz
providers and nothing else, so it holds no client for any of them.

## Two defects in the measurement itself

The extractor was wrong four times before it was right, and two of the errors would each have
invalidated the finding. They are recorded because a coverage number derived by new code is only as
good as the bugs that were removed from it.

| Defect | Symptom | Fix |
| --- | --- | --- |
| A bare interpolation token was allowed to match as **prefix and suffix** | The single line `return \`${workspace.route}/${view.key}\`;` at `apps/admin/app/domain-workspaces.ts:122` yields exactly one token, `/:p`. Under two-way leniency that one token covered **11 unrelated endpoints** — all of `branch-continuity`, `edge-sync` and `platform` — as both a prefix and a suffix. The audit would have reported them reachable because one line built a route | A token segment of `:p` may cover a route segment of `:p` and nothing else. It may not cover a literal, and a literal token segment may not cover a param |
| A path **assembled from a ternary on one line** was not recognized | `hr-payroll.tsx` builds `/payroll/${kind==='tax'?'/payroll/tax-rule-sets':'/payroll/social-security-rule-sets'}/${rule.id}/approve` — exact matching reported **both** approvers unreachable while a user was clicking them | Coverage is per line and per contiguous run of segments, so the literal half of the ternary is read as its own token and prefix + suffix jointly cover the route |

Four further defects were removed and each moved the number: a quote-pairing regex that drifted parity
and missed every `/auth/2fa/*` call; a missing `api<T>(...)` type-parameter group that hid **68**
call sites; a `^\/(assets|_next|...)` filter that collided with the `/assets` **API namespace**; and
`collectRoutes` returning declarations without verdicts, which made the summary print **0 reachable
routes beside 36 fully-reached controllers**. The last is why the report re-derives the verdict onto
the array it returns instead of onto private copies.

## What was changed

| File | Change |
| --- | --- |
| `scripts/lib/frontend-endpoint-coverage.mjs` | New derived rule: route and UI collection, path normalization, per-line coverage, per-route verdict, sibling inconsistency detection, `FLAG_IDENTITY` |
| `scripts/audit-frontend-endpoint-coverage.mjs` | New report writer and baseline gate; fails on an added, removed or under-justified entry |
| `config/frontend-endpoint-coverage-baseline.json` | New human-edited ledger: 34 entries, each with a class and a basis of at least 40 characters |
| `tests/frontend-endpoint-coverage.test.mjs` | New, 8 controls |
| `tests/product-completeness-p0.test.mjs` | Finding-count assertion moved 16 → 17 |
| `package.json` | New `audit:endpoint:coverage`, chained into `audit:full:repo` |
| `config/product-completeness.json` | `audit:A-17` registered as finding 17 |

### The rule

An endpoint is **unreachable** when no line in any UI application source covers its normalized path
while a **sibling on the same controller is reached**. Path normalization rewrites every parameter
segment and every interpolated segment to `:p`, so `/items/:id` and `/items/${id}` compare equal.
Comparisons are then exact, prefix, suffix or **assembled-segment**: the segments of a call-site token
must line up 1:1 with a contiguous run of route segments. Coverage is computed **per line**, which is
what lets the assembled ternary count and stops the bare interpolation from counting.

The scope follows the in-repo clients rather than a list of app names. `apps/customer-mobile` was
assumed to be an empty scaffold and is not: it is a Flutter application whose three Dart files call
`/platform/manifest` and `/api/v1/products`, so `.dart` is in the scanned extensions and those two
paths are covered. `apps/worker` talks only to Telegram and Digiflazz and is out of scope, which is
what makes the `NODE_PROTOCOL` classification a measurement rather than a guess.

### The ledger is human and the gate fails both ways

`config/frontend-endpoint-coverage-baseline.json` is edited by a person, never written by the script.
The audit exits non-zero when the measured set differs from it **in either direction**: a new dead
sibling fails as surely as a stale entry does. A reason shorter than 40 characters also fails, because
an exception with no stated basis is not a review.

The anti-silencing control is derived, not listed:

> An endpoint behind `@Roles` is human-facing by construction and may only ever be classified
> `UI_GAP`. The rule reads the decorator, so relabeling a missing screen as node protocol fails the
> gate instead of clearing it.

Without it the cheapest way to make the audit green again is to edit the class of whatever the audit
just found. Three of the 8 `UI_GAP` entries are `@Roles`-guarded, so that shortcut is closed.

## Evidence

| Evidence | Meaning |
| --- | --- |
| `scripts/lib/frontend-endpoint-coverage.mjs` | The derived rule |
| `scripts/audit-frontend-endpoint-coverage.mjs` | Report writer and baseline gate |
| `config/frontend-endpoint-coverage-baseline.json` | The reviewed ledger of 34 |
| `tests/frontend-endpoint-coverage.test.mjs` | Eight controls |
| `config/f1-backend-ui-audit.json` | The predecessor whose 45/46 `EXPOSED_OR_PARTIAL` is the measured defect |
| `tests/product-completeness-p0.test.mjs` | Finding-count assertion moved 16 → 17 |
| `config/product-completeness.json` | `audit:A-17` registered; its notes carry the measurement |
| `work-items/completed/T360-20261015-164416-a-17-endpoint-coverage-is-measured-at-controller-granularity.json` | The work item |
| `handoff/release-evidence/T360-20261015-164416-a-17-endpoint-coverage-is-measured-at-controller-granularity.md` | This document |

CI run identifiers are recorded in the follow-up `docs(A-17)` commit on the same change, which is the
same two-commit shape A-16 used: the fix lands, the workflows run on that exact source, and the run
numbers are written back afterwards rather than predicted.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| Coverage is measured per endpoint, not per controller | Pass — 532 routes classified individually; 34 flagged |
| Every flagged endpoint is classified with a written basis | Pass — 34 of 34, all bases ≥ 40 characters |
| An unreachable endpoint behind a reachable sibling fails the run | Pass — the measured set is asserted against the ledger in both directions |
| An API-only controller flags nothing | Pass — `edge-sync` 0/3 contributes nothing |
| A dead sibling with a live sibling is flagged | Pass — mixed fixture flags exactly one endpoint |
| An assembled ternary path counts as reached | Pass — pinned on the `hr-payroll.tsx` shape, red before the fix |
| A bare interpolation cannot certify unrelated endpoints | Pass — pinned on the `domain-workspaces.ts:122` shape; 11 endpoints covered before the fix |
| Removing a ledger entry re-surfaces the endpoint | Pass |
| A `@Roles` endpoint cannot be filed as protocol | Pass — derived from the decorator |
| The audit runs in CI | Pass — chained into `npm run audit:full:repo`, executed by both heavy workflows |
| `productReady`, `currentPhase`, `humanStage20` untouched | Pass |

## Local verification

| Gate | Result |
| --- | --- |
| `node --test tests/frontend-endpoint-coverage.test.mjs` | **8/8** |
| `npm run test:dependency-free` | **1886/1886**, up from 1878 |
| `npm run lint` | exit 0 |
| `npm run workflow:validate` | 56 work items, 8 waves |
| `npm run validate:repo` | 1232 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS — full repository 1233 files / 532 API handlers / 514 UI elements, product completeness **17 findings**, **endpoint coverage 34 agreed with 34**, admin contextual 70/70, canonical ownership 9 domains, P5 visual |

## Product state

| Field | Value |
| --- | --- |
| `productReady` | `false` — unchanged |
| `humanStage20` | `PENDING` — unchanged |
| `currentPhase` | `P5` — unchanged |

## What this does not claim

**A-17 closes the guard, not the gaps.** The 8 `UI_GAP` entries are recorded as open work and are
explicitly *not* exceptions; the ledger says so in its own note so the file cannot be read as a
waiver. Closing them is separate UI work on separate screens — `branch-transfer` departure and detail,
digital-services transaction detail, the bulk offline-transactions post, the automation-jobs detail,
and the scan/submit/discard steps of the mobile opname draft.

It does not claim the 22 `NODE_PROTOCOL`, 2 `SUPERSEDED`, 1 `DEVICE_INGEST` and 1 `PROVIDER_CALLBACK`
entries are bugs; each is an explanation of where the other side of the call lives, with the evidence
in the row. It does not claim the F1 controller audit was wrong — it was too coarse, and it still
runs.

It touches no runtime path: no route is registered, moved or removed, no permission or tenant scope
changes, no schema is touched, and no business logic executes. The change is source, config, a test
and a `package.json` chain entry. A-07 remains the human visual gate and is not addressed by this.
