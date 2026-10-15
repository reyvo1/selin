# Release Evidence — T360-20261015-045528

A-13 — Ubuntu workflow cluttered with Windows-first launchers.

## Summary

CLOSED / RUNTIME_VERIFIED. The launchers this finding described were already removed, so
`PARTIAL` was a status lagging the evidence — the A-14 class of defect. The prose claim is now
a gate that can fail.

## Measured before intake (2026-10-14)

| Check | Result |
| --- | --- |
| Tracked `.bat`/`.cmd`/`.ps1`/`.vbs` files (`git ls-files`) | **0** |
| `package.json` scripts invoking `cmd.exe`, `powershell`, `notepad`, or a `.bat`/`.cmd` target | **0 of 123** |
| `docs/` lines matching a Windows operator command | **1** — the A-13 acceptance criterion itself |

## What the gate allows, and why

`win32` branches inside Node scripts (`process.platform === 'win32'` / `isWindows`) are
platform-guarded cross-platform developer support and a no-op on Ubuntu. The gate asserts
these files stay guarded rather than being deleted: removing them would be a regression, not
a cleanup. The rule is about operator-facing launchers and npm entry points only.

## Evidence

- `tests/ubuntu-workflow-windows-launchers.test.mjs` (6 controls: tracked launchers, npm
  scripts, synthetic `.cmd` caught, synthetic windows-only script caught, guarded files stay
  guarded, docs keep the Ubuntu-first statements)
- `source-commit:c938056`
- Workflow Governance `38684782214` success on `c938056`

## Verification basis

| Workflow | Run | Conclusion |
| --- | --- | --- |
| Workflow Governance | `38684782214` | success |
| Toko360 Full Automated UAT | `38684782158` | success |
| Toko360 Full System Simulation | `38684782278` | success |

## Local gates

| Command | Result |
| --- | --- |
| `node --test tests/ubuntu-workflow-windows-launchers.test.mjs` | **6/6 PASS** |
| `npm run test:dependency-free` | **1867/1867 PASS** (was 1861; +6 new) |
| `npm run lint` | PASS |

## Not claimed

- `productReady` remains `false`, `currentPhase` remains `P5`, `humanStage20` remains `PENDING`.
- No business logic, API contract, permission, tenant/branch authority, schema or runtime path
  changed; no existing assertion was weakened; no file was deleted.
