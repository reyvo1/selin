# Release Evidence — T360-20261014-113115

A-09 / A-12 — replace the five-path hygiene allow-list with a general rule, then close both findings.

## What was actually wrong

`scripts/audit-product-completeness.mjs` guarded the "no tracked credential, no tracked runtime
evidence" invariant with four expressions:

```js
file === 'payroll-adjustment-postgres-stage.env' ||
file.endsWith('.recovery-backup') ||
/^handoff\/quality\/.+\.(json|md)$/.test(file) ||
/^logs\/(payroll-adjustment-postgres-stage|report-exports|stage20-release-readiness)\//.test(file)
```

A single literal env path, one backup suffix, two generated directories and **three named**
`logs/` subdirectories. A credential file at `staging.env`, a key at `server.pem`, a secrets JSON,
or a runtime artifact under `logs/uat-anything/` passed green. The retired rule would have reported
PASS on a repository that violated the very invariant it claimed to enforce — which is finding A-02
applied to the gate that was supposed to close A-09 and A-12.

## What changed

`scripts/lib/tracked-hygiene.mjs` (new) implements a general rule:

| Rule | Scope |
| --- | --- |
| `env-file` | any tracked env file without the `.example` placeholder suffix, at any path |
| `key-file` | `.pem .key .p12 .pfx .jks .keystore .der`, `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` (`.pub` allowed) |
| `credential-file` | `credentials`/`secret`/`service-account` JSON containers |
| `generated-quality` | every `handoff/quality/*.{json,md}` (`.gitkeep` stays) |
| `runtime-log` | **every** path under `logs/`, not three subdirectories |
| `recovery-backup` | any backup named `*recovery-backup*` |
| `secret-content` | private-key blocks and provider tokens in **every** tracked file; connection strings with non-placeholder passwords outside fixtures and `.example` files |

Escaping a rule requires a path-scoped, rule-scoped exemption whose rationale is at least 20
characters — the same contract as `SOURCE_BINDING_EXEMPTIONS`. `HYGIENE_EXEMPTIONS` ships empty
and a test asserts it stays that way.

## Measured, not assumed

Before writing the content rule the repository was scanned: 19 tracked files contain a database
connection string. They are `.example` files, the three CI workflows, `docs/DATABASE-PROFILES.md`,
three scripts, and six tests — and every password is a placeholder (`CHANGE_ME_*`, `USER`/`PASSWORD`,
`toko360`, `toko360_ci_password`, `toko360_dev_password`, `schema_check`, `secret`, `p`). No
private key, AWS key, GitHub token or OpenAI key exists in tracked content. **No exemption was
needed, so none was granted.**

The only two non-placeholder passwords are `alice:p%40ss` inside test fixtures. Rather than add a
per-path escape, the content rule is tiered by contract: provider tokens and private keys are
checked everywhere including tests, while connection strings are skipped in `tests/**` and
`.example` files — the env/key/credential rules still apply at any path, so a real credential
cannot hide behind the fixture rule. The test that pins this constructs its forbidden content at
runtime, because the gate reads the test file too.

## Acceptance criteria → evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Audit fails for a forbidden file at any path, not the five hard-coded ones | `classifyTrackedFile` + audit wiring; tests 3–7 |
| 2 | Non-placeholder connection string fails; exemptions path-scoped with ≥20-char rationale | tests 6, 8, 9; `HYGIENE_EXEMPTIONS` asserted empty |
| 3 | Regression test proves both directions; p0 assertions strengthened, nothing removed | `tests/tracked-hygiene-gate.test.mjs` (12 tests); `tests/product-completeness-p0.test.mjs` evidence check now runs `validateEvidenceArray` |
| 4 | `audit:product:completeness` and `audit:full:repo` pass on the real repo; hardened audit runs inside both heavy workflows | local PASS; `audit:full:repo` step success in both workflows |
| 5 | A-09 and A-12 promoted with resolving evidence; everything else unchanged | statuses below; 48-feature matrix, `productReady`, `currentPhase`, `humanStage20` untouched |
| 6 | All three workflows green on the exact commit containing the promotion | see below |

One assertion was deliberately converted: `assert.match(auditSource, /file === 'payroll-adjustment-postgres-stage\.env'/)`
demanded the literal that *was* the defect. It is replaced by behaviour-level controls (a credential
file and an unlisted `logs/` directory must be rejected), and the same test now validates findings'
evidence through the resolver instead of checking `evidence.length`.

## Verification basis — exact commit `5692b19bd1259bfda387eb4b66ac87115b5e5c51`

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38558772486` | success |
| Toko360 Full Automated UAT | `38558772478` | success (7m47s) |
| Toko360 Full System Simulation | `38558772502` | success (8m44s, rerun) |

The first Simulation attempt failed for an infrastructure reason unrelated to this change:
`uat:browser:built` reported *"Chrome menolak start (bukan timeout) — dbus: Failed to connect to
the bus: Address does not contain a colon"*. `ci:r7:probe` and `ci:p5:probe` then failed closed
because the browser evidence was not `PASS`, and `ci:r8:probe` failed because
`handoff/quality/github-r7-ui-probe-latest.json` never existed. The rerun passed end to end. No
code was changed between the two attempts, and the fail-closed chain behaved as designed.

## Local gates

| Command | Result |
| --- | --- |
| `npm run test:dependency-free` | **1850/1850 PASS** (was 1838; +12 new) |
| `npm run lint` | PASS, all workspaces, strict TypeScript |
| `npm run workflow:validate` | PASS, 49 work items, 8 delivery waves |
| `npm run validate:repo` | PASS, 1208 files, 202 Prisma models |
| `npm run audit:full:repo` | PASS, 7 audits |
| `npm run audit:product:completeness` | PASS with A-09 and A-12 promoted |
| `node --test tests/product-completeness-p0.test.mjs` | 5/5 |

## Findings state after this change

`A-09` HIGH → `RUNTIME_VERIFIED`, `A-12` MEDIUM → `RUNTIME_VERIFIED`, both with
`source-commit:5692b19…` + `logs_38558772478.zip` + `logs_38558772502.zip` + the implementation
file and its regression test. Open findings drop from 7 to 5: A-02 (CRITICAL), A-07 (HIGH),
A-13, A-14, A-15 (MEDIUM).

## Not claimed

- `productReady` remains `false`, `currentPhase` remains `P5`, `humanStage20` remains `PENDING`.
- Verification-layer only: no business logic, API contract, permission, tenant/branch authority,
  schema or runtime mutation path changed.
- A-02 remains `IMPLEMENTED_RUNTIME_PENDING`: this change removed one more narrow gate but did not
  prove that none other exists.
- No credential, token or database URL is printed, persisted or diffed by the gate — it reports a
  path, a rule name and a reason, never the offending content.