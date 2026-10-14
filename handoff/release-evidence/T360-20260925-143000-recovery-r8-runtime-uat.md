# Release Evidence — T360-20260925-143000

R8 — GitHub full runtime UAT and release evidence (automated layer only).

## What this closes

R8 is the final **automated** recovery evidence layer. Its single documented blocker was
`docs/R8-GITHUB-FULL-RUNTIME-UAT.md`: "it cannot be declared CLOSED until the exact-source R7 gate is
PASS", plus its `dependencies: ["T360-20260923-221011"]`.

Both are satisfied:

- `T360-20260923-221011` is `CLOSED` (released 2026-10-11T05:08:57+08:00) with
  `handoff/release-evidence/T360-20260923-221011-full-ui-tailwind-and-github-uat-expansion.md`.
- The exact-source R7 gate passed inside the R8 probe chain on current source: the probe reads
  `handoff/quality/github-r7-ui-probe-latest.json`, requires `status === 'PASS'`, and throws if its
  `sourceIdentity.value` differs from the current fingerprint. Both GitHub workflows report
  `STEP_R7_UI: success` on the verification commit.

The work item had been `BLOCKED` since creation (2026-09-25), which predates R7 closure. Because
`config/workflow-policy.json` assigns `phaseOrder.BLOCKED = 99`, `scripts/workflow.mjs` refuses to
advance out of BLOCKED. The engine's own error prescribes the remedy — "Gunakan work item baru atau
dokumentasikan rollback fase secara manual" — so the rollback to `VERIFICATION` was performed manually
and the justification is recorded in the work item's `businessRules`, not by weakening the guard.

## Acceptance criteria → evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | `ci:uat:coverage` classified `SOURCE_CONTRACT`, not runtime closure | `scripts/ci-critical-uat-coverage.mjs:60-61` emits `evidenceClass: 'SOURCE_CONTRACT'`, `runtimeClosure: false`; executed in the System Simulation workflow |
| 2 | `ci:r8:reporting-security-probe` passes F23/F24/F25/F44 on PostgreSQL runtime | `STEP_R8_REPORTING_SECURITY: success`; upstream test `ok 1364 - R8 executes reporting/security runtime proof for F23 F24 F25 and F44`; the R8 probe re-checks `Object.values(r8Reporting.checks).every(Boolean)` |
| 3 | Built Browser UAT emits `R8_SAFE_MUTATION_JOURNEYS` with owner-reporting + HR mutation evidence and `productionTouched=false` | Emitted at `scripts/browser-uat.mjs:1305` with domains `['owner-reporting','hr-employee-master']`; the probe rejects absence, non-PASS, `productionTouched !== false`, or fewer than two journeys (`ci-r8-release-evidence-probe.mjs:41-42`). `STEP_BUILT_BROWSER: success` |
| 4 | `ci:r8:probe` emits 12/12 executed critical scenarios bound to current source and exact build artifact | Output `status: PASS`, `scenarioCount: 12`, 12/12 `PASS`, each with non-empty `executedEvidence`; `sourceIdentity` sha256 `019b50aacbebd12a4e97ad7a362f1276a20a2379301c8d53bac0425123e82fa5` (913 files) and `buildArtifactId` `0a42c8007b4e485622552c7c9b939e7c9290e90066eaae270608583d7e45dde1` |
| 5 | Both PostgreSQL workflows execute both R8 probes with no bypass in aggregate enforcement | `toko360-full-uat.yml` runs both steps and `check "R8 reporting/security runtime probe" "$STEP_R8_REPORTING_SECURITY"` / `check "R8 exact-source release evidence" "$STEP_R8_RELEASE"`; `full-system-simulation.yml` passes both outcomes into `ci-write-full-system-summary.mjs` and `ci:summary:github:assert` fails the job on any `failures.gates` / `failures.steps` entry |
| 6 | Full-system summary and GitHub UAT report surface both R8 gates | Summary gate predicates at `ci-write-full-system-summary.mjs:135-136`; report rows at `github-uat-report.mjs:32-33`. Log shows `| R8 reporting/security runtime probe | success |` |
| 7 | Human Stage-20 remains PENDING after automated R8 PASS | Probe output `humanStage20: "PENDING"`, `productionTouched: false`, and `STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING` |

## Verification basis — exact commit `0f4b38d`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38545068220` | success |
| Toko360 Full System Simulation | `38545068348` | success |
| Toko360 Full Automated UAT | `38545068254` | success |

From the UAT job log:

```
Build gate PASS
Migration rehearsal PASS — 1 migration(s) membawa baseline 56cbd9c... ke schema saat ini.
UAT candidate fail-closed assertion PASS: hanya Human Stage-20 yang masih pending.
STEP_R7_UI: success   STEP_R8_REPORTING_SECURITY: success   STEP_R8_RELEASE: success
STEP_BUILT_BROWSER: success   STEP_STAGE20: success   STEP_CANDIDATE: success
STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING
{ "status": "PASS", "scenarioCount": 12, "productionTouched": false, "humanStage20": "PENDING" }
```

## Local test plan

| Command | Result |
| --- | --- |
| `node --test tests/recovery-r8-runtime-uat.test.mjs` | 10/10 PASS |
| `npm run audit:recovery` | PASS — 48/48 mapped, 0 unmapped, 202 Prisma models, 532 API handlers, 514 UI controls; wave distribution `{"R0":5,"R1":4,"R2":11,"R3":10,"R4":7,"R5":3,"R6":3,"R7":2,"R8":3}` |
| `npm run test:dependency-free` | 1827/1827 PASS |
| `npm run lint` | PASS, all workspaces, strict TypeScript |
| `npm run workflow:validate` | PASS, 47 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1198 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS, 7 audits |
| `npm run ci:ui:audit` | PASS, 514 controls |

## Known limitation — disclosed, not hidden

`scripts/ci-r8-release-evidence-probe.mjs:47-53` builds the twelve critical scenarios from a **static**
`id → evidence-ref` table whose rows are stamped `PASS`, and sets `executedCriticalScenarios`,
`exactSource`, `r8ReportingSecurity` and `humanStage20Pending` as constants. What is genuinely enforced
is lines 33-45: every referenced artifact must report `PASS`, and every artifact that carries a
`sourceIdentity` must match the current fingerprint or the probe throws.

Two residual weaknesses follow, and they are the reason post-audit finding **A-02 (CRITICAL, P0)
"Audit/test design can report green while product incomplete"** remains open:

1. `if (s && s !== source.value)` skips the staleness check entirely for an evidence file that has no
   `sourceIdentity` at all.
2. The per-scenario `status: 'PASS'` is derived from coverage mapping, not observed per scenario.

Neither produced a false PASS for this closure — all thirteen source-carrying artifacts matched the
current fingerprint and reported PASS — but the gate is weaker than its output reads. This closure is
therefore explicitly **not** evidence that A-02 is resolved; A-02 is the next work item.

## What this does NOT claim

- `productReady` remains `false`.
- `currentPhase` remains `P5` / `IMPLEMENTED_RUNTIME_PENDING`.
- `humanStage20` remains `PENDING`; this closure does not record or imply human visual acceptance.
- **P6 must not start.** `config/product-completeness.json` verification gate: "P5 cannot close and P6
  cannot start until a human explicitly accepts the V2 runtime presentation after automated
  exact-source PASS", and its acceptance criterion: "P5 V4 human visual acceptance is explicitly
  recorded only after the local runtime is visibly accepted and exact-source automation passes; only
  then may P6 start." The V4 automated evidence is green; the human acceptance has not happened.
- R8 does not replace Human Stage-20, and no automated probe may mutate it.