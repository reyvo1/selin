# Release Evidence — T360-20261014-183210

A-02 hardening — audit and test gates against vacuous green.

## Scope, stated honestly

This work item closes **two demonstrated instances** of post-audit finding A-02 (CRITICAL, P0). It
does **not** close A-02. The canonical status in `config/product-completeness.json` remains
`IMPLEMENTED_RUNTIME_PENDING` and its `status` string was not touched.

## What was actually broken

Reading the gate that produced R8's evidence was what surfaced this:

1. `scripts/ci-r8-release-evidence-probe.mjs` assembled the twelve critical UAT scenarios from a
   **static** `id → evidence-ref` table whose rows were stamped `PASS`, then emitted
   `executedCriticalScenarios: scenarios.length === 12` — a table compared against its own length.
   `exactSource`, `r8ReportingSecurity` and `humanStage20Pending` were boolean literals.
2. `if (s && s !== source.value)` **skipped the stale-source comparison** for any artifact that
   arrived without `sourceIdentity`. An artifact carrying no identity at all was accepted as long as
   it reported `status: 'PASS'`.
3. `scripts/audit-product-completeness.mjs` closed the evidence question with
   `!(item.evidence?.length)` — array length. `feature:pos_offline` was `RUNTIME_VERIFIED` on
   `evidence: ["historical automated evidence only"]` and `audit:A-01` on a single prose sentence,
   while `docs/PRODUCT-COMPLETENESS-STATUS.md` states `RUNTIME_VERIFIED` requires exact-source
   runtime evidence.

## Changes

| File | Change |
| --- | --- |
| `scripts/lib/r8-evidence-binding.mjs` (new) | `assertSourceBinding` fails closed on missing `sourceIdentity` unless exempted with a rationale of ≥20 characters; `evaluateScenarioCoverage` derives coverage from artifacts that are `PASS` **and** fingerprint-matched; `declaredProductionTouched` collects any artifact reporting `productionTouched: true`; `SOURCE_BINDING_EXEMPTIONS` starts empty |
| `scripts/ci-r8-release-evidence-probe.mjs` | `exactSource`, `exactBuildArtifact`, `executedCriticalScenarios`, `r8ReportingSecurity`, `safeBrowserMutationJourneys`, `providerChain`, `loadIndependentHumanGate`, `humanStage20Pending` are all **computed** from evidence read this run; throws when a scenario loses an artifact or points at an unbound/un-PASS one. Output schema unchanged |
| `scripts/lib/evidence-resolver.mjs` (new) | Evidence must classify as an existing repository file, a **registered** CI artifact that a script under `scripts/` really produces, `logs_<run>.zip`, or `source-commit:<sha>`; prose fails; `RUNTIME_VERIFIED`/`HUMAN_ACCEPTED` need a concrete anchor |
| `scripts/audit-product-completeness.mjs` | Uses the resolver; validates the new `runtimeEvidenceArtifacts` registry both ways (script-backed **and** untracked); the old length check and the redundant CRITICAL/HIGH duplicate are gone |
| `config/product-completeness.json` | Adds `runtimeEvidenceArtifacts` (23 entries, all script-produced and untracked); `feature:pos_offline` evidence → `handoff/quality/github-r3-residual-probe-latest.json`; `audit:A-01` prose → `source-commit:` + three `logs_*.zip`, narrative moved to `evidenceNotes` |
| `tests/vacuous-green-gate.test.mjs` (new) | 11 negative controls |

`feature:pos_offline` is not a downgrade or an invention: `ci-r3-residual-probe.mjs` really executes
`syncReceipt`, `offlineTransaction`, device diagnostics, `ack` and `requeue` on PostgreSQL and emits
`sourceIdentity`, and `ci:r8:probe` re-binds it to the current fingerprint as `UAT-08-OFFLINE-SYNC`.

## One test expectation changed, on purpose

`tests/recovery-r8-runtime-uat.test.mjs` asserted `/r8ReportingSecurity:true/` — it demanded the
constant. Under the master workflow's root-cause rule an expectation changes only when it is proven
stale against the documented contract, and here the expectation **was** the defect. It now requires
the value to be derived from `r8ReportingCheckValues` and explicitly fails if a literal
`r8ReportingSecurity: true` reappears. No assertion was removed or narrowed; the bar moved up.

## Acceptance criteria → evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Probe fails closed on missing `sourceIdentity`; exemptions explicit | `assertSourceBinding` throws; `SOURCE_BINDING_EXEMPTIONS` is empty and asserted empty by test 7 |
| 2 | `executedCriticalScenarios` derived, fails when a row loses its artifact | `evaluateScenarioCoverage` + explicit throw listing `[hilang: …]` / `[tidak terikat/PASS: …]`; tests 8 |
| 3 | `exactSource`, `r8ReportingSecurity`, `humanStage20Pending` computed | Probe output `checks` block; test 11 asserts no literal `:true` remains |
| 4 | Every `RUNTIME_VERIFIED`/`HUMAN_ACCEPTED` entry resolves; `pos_offline` bound or downgraded | Bound to the real R3 artifact; tests 1–6 |
| 5 | Dependency-free regression fails the build on unresolvable evidence | `tests/vacuous-green-gate.test.mjs`, 11 tests |
| 6 | Both GitHub heavy workflows stay green with the hardened probes | See below |

## Verification basis — exact commit `1256c01`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38553931267` | success |
| Toko360 Full System Simulation | `38553931368` | success (8m50s) |
| Toko360 Full Automated UAT | `38553931228` | success (9m49s) |

Hardened probe output from that run:

```
status: PASS | scenarioCount: 12 | productionTouched: false | humanStage20: PENDING
sourceIdentity: 65ac7d665ffa31fd… (916 files)
checks: exactSource, exactBuildArtifact, executedCriticalScenarios, r8ReportingSecurity,
        safeBrowserMutationJourneys, providerChain, loadIndependentHumanGate,
        humanStage20Pending — all true, all derived
scenarios: 12 × PASS
STEP_R7_UI / STEP_BUILT_BROWSER / STEP_R8_REPORTING_SECURITY / STEP_R8_RELEASE /
STEP_STAGE20 / STEP_CANDIDATE: success
STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING
```

## Local gates

| Command | Result |
| --- | --- |
| `npm run test:dependency-free` | **1838/1838 PASS** (was 1827; +11 new) |
| `npm run lint` | PASS, all workspaces, strict TypeScript |
| `npm run workflow:validate` | PASS, 48 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1204 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS, 7 audits |
| `npm run audit:product:completeness` | PASS, 48 features / 12 legacy phases / 15 findings |
| `npm run audit:recovery` | PASS, 48/48 mapped |
| `npm run audit:canonical:ownership` | PASS, 9 domain records |
| `npm run ci:ui:audit` | PASS, 514 controls |

## Sweep performed, and its limit

Every `checks` object literal under `scripts/*.mjs` was scanned: **zero** remain all-literal. The
probes that emit `status: 'PASS'` (`ci-r1`, `ci-r2`, `ci-r4`, `ci-r6`, `ci-p2`, `ci-p3`) are
fail-fast — they throw on the first failed expectation — or downstream-enforced by
`Object.values(checks).every(Boolean)` in the summary gate. No third instance was demonstrated.

That is a bounded sweep, not a proof. A-02 remains open precisely because "found nothing else in
this scan" is not evidence that no other audit can report green without substance.

## Not claimed

- A-02 is **not** closed; `status` stays `IMPLEMENTED_RUNTIME_PENDING`.
- `productReady` remains `false`, `currentPhase` remains `P5`,
  `humanStage20` remains `PENDING`.
- Verification-layer only: no business logic, API contract, permission, tenant/branch authority,
  schema or runtime mutation path changed, and no assertion was weakened.
- No credential, token, database URL or artifact payload is read into an assertion or log line.