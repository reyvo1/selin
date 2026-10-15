> **Canonical product status:** `config/product-completeness.json` is the only machine-readable completion authority. Historical recovery/F1/F12 status below is evidence/context, not proof of product completeness.
>
> **Counting rule for this file:** every number below is the count *at the time that wave was authored* and is kept as a historical record. Nothing here states a current value: regenerate the controller, API handler, Prisma model, contextual destination and interactive control counts with `npm run audit:p5:visual` into `config/p5-full-ui-root-audit.json`, the file and model counts with `npm run validate:repo`, and the regression count with `npm run test:dependency-free`. Do not treat a number in a dated section as a current one.
>
> **Historical note:** this file was originally authored on a machine that had no `.git` in the working copy, so commit SHAs and source fingerprints below are notes from that machine. Verify any of them against `git log` on the current repository before quoting them.

# Toko360 Project State

## Official checkpoint

```text
RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF
```

## Baseline

- Version: 0.5.3
- Development profile: SQLite, tanpa Docker
- Production profile: PostgreSQL
- GitHub PostgreSQL validation: tersedia
- Development workflow: aktif
- One-click work automation: aktif
- Embedded system instructions: aktif, maksimal 8.000 karakter
- Dynamic first-chat/session handoff: aktif
- Active work items: lihat `work-items/active/`
- Completed work items: lihat `work-items/completed/`

## Source of truth

1. `instructions/SYSTEM-INSTRUCTIONS.md`
2. `docs/DEVELOPMENT-KIT.md`
3. `docs/DEVELOPMENT-WORKFLOW.md`
4. `config/module-delivery-map.json`
5. `config/workflow-policy.json`
6. Work item aktif
7. Commit/tag checkpoint resmi

## 2026-09-26 — P4 runtime closure / P5 FULL visual rebuild

P4 is **RUNTIME_VERIFIED** on exact-source commit `d305ade2050765de86c7f5ef1c54eb7426c5e25b`, source fingerprint `cf6165fcc74e94abb3866230aa1764cee9487d4de6b630377465d20bda7d9246`. P4 canonical ownership, Stage-19, automated Stage-20, R8, full-system aggregate and Automated UAT are green on this source. A-10 is closed and P0-P4 source is frozen absent regression evidence. Human Stage-20 remains separately PENDING.

P5 is now **IMPLEMENTED_RUNTIME_PENDING** as one full visual-product wave across Admin, POS, Storefront and Employee Portal. `config/p5-visual-surface-map.json` defines 14 Admin primary workspaces, 13 representative contextual routes, 4 POS views, 5 Storefront views, 7 Employee Portal views, and the 1440/1024/390 responsive matrix. `audit:p5:visual` fails closed on source-contract regressions; both heavy GitHub workflows require `ci:p5:probe` against exact-source Browser UAT screenshot evidence. Automated P5 evidence must keep human visual acceptance explicitly PENDING until human review is recorded.

P5 V1 and V2 automated candidates passed exact-source automation but were **REJECTED** by human runtime review. P5 V3/V3.3 also failed the human visual bar: screenshots still showed a legacy-skin feel, weak composition, and POS/Admin presentation that did not demonstrate the requested professional redesign. P5 V4 is therefore active as **ONE P5 FULL V4 TOTAL PRESENTATION REBUILD**. Four product shells and compatibility layers are replaced together with Tailwind CSS v4, runtime identity is verified from computed styles rather than screenshot existence alone, and business/API/permission/domain authority remains frozen. Canonical V4 contract: `config/p5-v4-total-ui-rebuild.json` + `docs/P5-V4-TOTAL-PRESENTATION-REBUILD.md`. Per explicit operator instruction, V4 must be reviewed locally for a visible change **before any commit/push**; P6 remains blocked until V4 local visual acceptance and exact-source automation both pass.

## Planned post-completion expansion

After the current P0-P7 product-completion program reaches Human Stage-20 acceptance and `PRODUCT_READY = true`, the next planned program is **POST-1 — Hybrid Multi-Branch Edge Operations**. Canonical plan: `docs/TOKO360-POST-COMPLETION-HYBRID-BRANCH-WORKFLOW.md`. It covers one local TOKO360 server per store/branch plus central hosting sync, local-first continuity, mobile/PWA + Telegram stock operations, and multi-device LAN barcode price-check kiosks. POST-1 is planning-only now and must not interrupt P4-P7.

## Aturan melanjutkan

- Jangan memakai ZIP/checkpoint yang lebih lama sebagai baseline.
- Jalankan `npm run workflow:validate` dan `npm run validate:repo` sebelum perubahan.
- Gunakan `npm run chat:handoff` sebelum berpindah chat; untuk akun baru jalankan `npm run chat:system` terlebih dahulu.
- Jangan mengubah database production dengan `db push`, reset, atau seed demo.
- Perbarui file ini hanya ketika checkpoint resmi baru diterbitkan.

## Active reopening — 2026-09-24 F12R4

Human visual acceptance kembali menolak presentasi F12R3 karena information architecture masih bertumpuk, beberapa capability sulit ditemukan, dan usability operator belum layak. Work item aktif `T360-20260923-221011` kini melakukan full UI architecture rebuild: satu Admin primary sidebar + satu contextual subnav, explicit Tenant/Organization, Settings/Access, Integrations/Notifications (Telegram/WhatsApp), AI/Automation, dan canonical Tailwind CSS v4 pada empat frontend. Deep GitHub Full UAT dari F12R3 tetap dipertahankan dan tidak boleh dilemahkan. Semua automated green evidence sebelum source rebuild ini adalah historical evidence dan tidak boleh dipakai untuk menyatakan source baru release-ready; Human Stage-20 tetap BLOCKED sampai visual acceptance baru lulus.

## Recovery R0 — 2026-09-24

Deep functional/UI/workflow audit reopened product completeness after human inspection and source reconciliation found 48 explicit gaps across truth/governance, tenant/access, HR/payroll, reporting/integrations, core hidden flows, assets/fleet, scale/AI, UI information architecture, and runtime UAT depth. The authoritative recovery work item is `T360-20260924-020700`. `config/recovery-finding-matrix.json` maps **48/48 findings, 0 unmapped** to R0–R8.

Current source baseline is HEAD `c391fc9fd8c42cb6352317853718cba1415a9603` plus the preserved uncommitted F12R4 working-tree changes. F12R4 work item `T360-20260923-221011` is now **BLOCKED**, not rejected or reverted: its presentation changes remain available, but final UI verification cannot resume until R1–R6 functional/operator-flow prerequisites stabilize.

Current generated counts: 180 Prisma models, 405 API handlers, 295 UI interactive elements; `audit:recovery` fails closed when these source-shape counts change without regenerating the R0 recovery matrix. Human Stage-20 remains BLOCKED/PENDING and no historical green run may be used as release evidence for recovered source.

## Recovery R1 — 2026-09-24

R1 is **CLOSED** on exact GitHub runtime commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`. Full System Simulation, Full Automated UAT, `ci:r1:probe`, PostgreSQL migration rehearsal, exact six-app build, runtime API sweep, Built Browser UAT, Telegram/WhatsApp provider simulation, worker/report probe, Stage-18, Stage-19, automated Stage-20, and aggregate automated gates passed on current R1 source. Human Stage-20 remains a separate PENDING gate and was not replaced by automation.

F07–F10 are runtime-closed by that evidence. No UAT assertion was weakened to obtain green; the final R1 fixes corrected real mobile layout, canonical nested navigation, and runtime-origin consistency while keeping fail-closed browser/provider gates intact.

## Recovery R2 — 2026-09-24

R2 is **CLOSED** on current green GitHub runtime evidence. The exact current-source chain passed `ci:r2:probe`, PostgreSQL runtime, six-app build, Built Browser UAT, Telegram/WhatsApp provider simulation, Stage-18, Stage-19, automated Stage-20, and aggregate gates. Human Stage-20 remains separate/PENDING. F11–F21 are runtime-closed for recovery sequencing.

## Recovery R3 — 2026-09-24

R3 is **IMPLEMENTATION** under `T360-20260924-195500-recovery-r3-reporting-integrations`. Scope is F22–F25, F29, F37, F39, F42–F44. The first implementation cluster fixes owner digest at the root: operator configuration is exposed, POST config/send require `notification.manage`, disabled digest cannot be manually sent, low-stock uses each product `minStock` without the old `available <= 10` prefilter, and configured recipients are verified/non-revoked Telegram `EmployeeChannelBinding` IDs rather than raw destination strings.

The GitHub provider simulation is strengthened to create and verify an employee Telegram binding through the real Employee Self-Service API and provider simulator before configuring/sending the owner digest. R3 remains open until the remaining integration/operator findings and current-source runtime/browser/provider evidence pass.

## Recovery R4 — 2026-09-24

R4 automated runtime is **CLOSED** on exact green baseline `4963f8acdf8b5a63a8cc79caad5162dcf26c3808`. R3 remains independently OPEN. R4 uses existing domain authority rather than replacing it: InventoryMovement remains append-only ledger truth, goods-receipt rejection remains pre-posting only, General Ledger reads posted journals, and promotion checkout remains server authoritative.

The only R4 schema expansion is `Supplier.isActive Boolean @default(true)` with SQLite/PostgreSQL parity. Inactive suppliers are excluded from new procurement but historical supplier transactions remain readable. Storefront environment branch code is bootstrap fallback; runtime users may switch among active sibling branches discovered from a current valid branch anchor. Human Stage-20 remains PENDING and separate from automated closure.

## Recovery R5 — 2026-09-25

R5 is **VERIFICATION** under `T360-20260925-000500-recovery-r5-assets-fleet`. Master scope is F31 `AssetMaintenancePlan` management, F32 `VehicleDriverAssignment` lifecycle, and F33 asset assign/transfer/dispose operator flow. R5 depends only on closed R1, so open R3 findings F29/F37/F39/F42/F43 do not block this wave.

R5 reuses the existing AssetMaintenancePlan and VehicleDriverAssignment schemas with no migration. Admin now exposes maintenance-plan lifecycle, driver assignment lifecycle, asset assignment, explicit Asset handover inspection, transfer, and disposal/sale. Transfer/disposal still require a PASSED/APPROVED inspection; the UI does not auto-pass the gate. F31/F32/F33 remain OPEN_REVALIDATION_REQUIRED until the new exact-source PostgreSQL `ci:r5:probe` and aggregate GitHub gates pass. Human Stage-20 remains PENDING.

## 2026-09-25 — R5 runtime closure / R6 verification

R5 F31/F32/F33 is runtime-closed on origin/main commit `708d34cb7afd259c507844cadf065b23029797ec`. GitHub `ci:r5:probe` PASS is bound to source fingerprint `91f5b3910bed430d5a682fb53a3ce8baf050884674be56269eb39af309781655` (629 files); both full-system workflows are green and Human Stage-20 remains PENDING.

R6 is now the active recovery wave. F26-F29 are source-implemented but require exact PostgreSQL runtime evidence before closure. F30 is recognized as runtime-closed by the R4 AccountingCloseControl close/block/reopen/post probe. R3 remains open for F37/F39/F42/F43; F29 moves to R6 verification because its secondary-wave runtime contract is now implemented here.

## 2026-09-25 — R6 runtime closure / R3 residual verification

R6 F26/F27/F28/F29 is **RUNTIME CLOSED** on exact GitHub commit `bd4abf386c56bce283f10c08ff988ea109909b54`, source fingerprint `1d07234c2f58891d1cf95309c65d4465d8c1bb4cb67b77bc4e9e233ae2c274c6` (631 files). Full System Simulation, Full Automated UAT, `ci:r6:probe`, aggregate release gates, and automated Stage-20 PASS. F30 remains runtime-closed by canonical R4 AccountingCloseControl evidence. Human Stage-20 remains **PENDING 12/12** and is not replaced by automation.

R3 is now **VERIFICATION** for residual F37/F39/F42/F43. Admin Integrations exposes payment-provider diagnostics, multi-outlet and cashier-target reporting, device sync receipt/offline-transaction diagnostics with acknowledgement/requeue operations, and marketplace order list/import. The new device diagnostics read route is authenticated tenant/branch scoped. Both PostgreSQL GitHub workflows execute `ci:r3:residual-probe`; these four HIGH findings remain `SOURCE_IMPLEMENTED_RUNTIME_EVIDENCE_PENDING` until exact-source runtime evidence passes. R7 remains blocked on R3 closure.

## 2026-09-25 — R3/R4 closure and R7 verification

Exact checkpoint `abac92662cab4cc7352de4f9f9d2e2419aad9c29` / source fingerprint `5006faaa354e32cdcfd952388a8dff76c712693835178ff53ff918875bf22615` passed Full System Simulation, Full Automated UAT, R3 residual probe, R4 core-business probe, provider/runtime gates, and automated Stage-20. R3 residual F37/F39/F42/F43 and R4 F34/F35/F36/F38/F40/F41 are therefore runtime-closed for sequencing. Human Stage-20 remains PENDING and separate.

R7 is now **VERIFICATION** under `T360-20260923-221011`. Primary scope is F45 canonical chart strategy and F46 final information architecture/operator discoverability. Admin retains exactly one primary sidebar plus one contextual secondary navigation. Dashboard analytics now use reusable canonical chart primitives rather than ad-hoc SVG colors/gradient behavior. Both PostgreSQL workflows require `ci:r7:probe`, which consumes exact-source Browser UAT evidence for all 14 Admin workspaces, contextual destinations, canonical analytics, screenshot evidence, and responsive no-overflow matrices across Admin, POS, Storefront, and Employee Portal. R8 must not start until this atomic R7 wave is committed/pushed/clean and exact-source R7 Browser UAT evidence passes.

## 2026-09-25 — R8 source implementation

R8 source implementation is prepared on checkpoint `5c9558c65a95a5000482decfc0f9185de042ffe3` while R7 remains exact-source VERIFICATION. F04/F05 now have explicit source-contract versus runtime-evidence separation; F06 has mandatory two-domain safe Browser mutation evidence; F23/F24/F25/F44 have a dedicated PostgreSQL runtime probe with cleanup/restoration. Both GitHub PostgreSQL workflows are wired for R8 reporting/security and final exact-source release evidence. R8 must not be classified CLOSED until current-source R7 and R8 GitHub evidence are PASS. Human Stage-20 remains PENDING.

## 2026-09-25 — Post-audit Product Completion Workflow activated

The 957/957 full functional/UI/script audit supersedes automated-R0-R8-green as the definition of product completeness. Automated recovery evidence remains valid engineering evidence, but the product is classified **NOT FUNCTIONALLY COMPLETE / NOT HUMAN-UI ACCEPTED** until the new P0-P7 product-completion workflow closes.

Active workflow: `docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md`.

Immediate order: P0 truth/security/hygiene -> P1 Admin contextual workflow isolation -> P2 Multi-UOM + payroll completeness -> P3 hidden capability productization -> P4 canonical/legacy cleanup -> P5 page-level visual rebuild -> P6 Ubuntu/operator hygiene -> P7 exact-runtime + Human Stage-20 acceptance.

Historical `docs/TOKO360-MASTER-RECOVERY-WORKFLOW.md` remains preserved as recovery history and runtime evidence sequencing, but does not override the new product-completion verdict or permit source-marker/browser-no-overflow evidence to substitute for real operator/human acceptance.

## 2026-09-26 — P3 runtime closure / P4 implementation history

P3 A-05/A-06/A-08/A-11 is **RUNTIME_VERIFIED** on exact commit `c61273e99104c0dbdc61ee4790379d4ed2edd8a3`, source fingerprint `cfe0323c096eb253730c1751e37ecc3a0b4e77853d3048360271ed97e360f8c5`. Both heavy GitHub workflows report P3 productization success; full-system aggregate and Automated UAT PASS. Human Stage-20 remains PENDING and separate.

P4 subsequently removed verified-unused `/sale-returns*` and `/purchase-returns*` compatibility routes, retained `/returns/*` as the only return mutation authority, and documented nine required domain owners/source-of-truth contracts. P4 is now runtime-closed by the newer exact-source P4 checkpoint recorded above; this section is historical implementation context only.

## P1 Admin contextual workflow isolation — 2026-09-25
- P0 atomic source is complete; active product-completion phase moved to P1.
- 62/62 Admin contextual destinations now have explicit canonical renderer mappings in `config/admin-contextual-workflow-map.json`; Customer is split from Category/Subcategory after operator discoverability review.
- Six previously non-isolated workspaces and two partial workspaces now route active contextual destinations into dedicated component modes.
- P1 canonical navigation root and 62-route category/customer correction are runtime-verified by green exact-source Browser/R7 evidence. Human IA/Stage-20 acceptance remains a separate pending gate; user explicitly authorized continuation into Product Completion phases while preserving that human-pending truth.

## 2026-09-25 — P1 runtime verification / P2A Multi-UOM source implementation

P1 canonical Admin routing including the 62-route Master Data Category/Subcategory vs Customer split is runtime-verified on exact-source commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`: Browser UAT, Built Browser UAT, R7/R8, worker/API/runtime sweeps, Stage-18, Stage-19, automated Stage-20 and aggregate gates passed. Human IA/Stage-20 acceptance remains a separate PENDING gate and is not replaced by automation. The user explicitly instructed continuation, so current implementation work advances to P2 while preserving that human-pending truth.

P2A source implementation centralizes POS/storefront selling-UOM resolution in `apps/api/src/common/transaction-uom.ts`; expands OrderItem, OrderReturnItem, SaleReturnItem and PurchaseReturnItem with immutable UOM lineage; keeps inventory/serial/batch quantities in integer base units; carries selling-UOM snapshots into shipment/accounting traceability; and makes Storefront product/cart/return flows UOM-aware. Historical return/refund logic copies source snapshots and never reconstructs OrderReturn conversion from current ProductUnit configuration. A-03 is `IMPLEMENTED_RUNTIME_PENDING` until the required exact-source PostgreSQL mixed-UOM order -> fulfill -> ProductUnit-change -> return/refund journey passes with inventory/accounting/tax invariants.


## 2026-09-25 — P2 FULL source implementation

P2 is now executed as one atomic delivery wave rather than separate operator-facing P2A/P2B waves. Multi-UOM persistence/runtime proof and Payroll method/split-period completeness ship together. P2 source adds historical transaction-UOM authority and required mixed-UOM PostgreSQL probe; Payroll adds executable GROSS/GROSS_UP/NET, temporal amount allocation for effective-dated component/profile/rule changes, operator method selection, and an exact-source PostgreSQL probe that posts payroll, settles salary, creates a post-payment differential adjustment, creates employee-receivable recovery, and settles that recovery.

A-03 and A-04 remain `IMPLEMENTED_RUNTIME_PENDING` until both dedicated P2 runtime evidence files pass on the exact source. P3 must not start until the P2 FULL wave is committed/pushed/clean and aggregate exact-source GitHub evidence is green. Human Stage-20 remains PENDING and is not auto-promoted by P2.

## 2026-09-26 — P2 RUNTIME_VERIFIED / P3 FULL source implementation

P2 FULL is runtime-verified on exact-source commit `899685ce23c08c8a0246867afc0c78a36507e674`, source fingerprint `36af0df55489492e4389f7bf0a511bbaa60cae761937b77edcd310003cdfa04d`. Dedicated P2A mixed-UOM and P2 Payroll probes, Stage-19 (11/11), payroll staging, automated Stage-20, R8 and aggregate all PASS across the supplied GitHub evidence. A-03 and A-04 are now `RUNTIME_VERIFIED`. Human Stage-20 remains separately PENDING.

P3 FULL is implemented as one large wave covering A-05 retention/archive productization, A-06 API-key/session security lifecycle, A-08 capability maturity truth, and A-11 daily-summary ownership. Settings now contains a Data Governance operator workspace; API Keys supports explicit rotation; Security exposes active-session inventory/revoke/logout-all; runtime feature metadata distinguishes enabled state from maturity and preserves maturity truth through scoped overrides; Daily Summary ownership is explicitly `ADMIN_EXPLICIT`. A dedicated exact-source `ci:p3:probe` is mandatory in both heavy GitHub workflows and aggregate evidence. P3 remains `IMPLEMENTED_RUNTIME_PENDING` until that probe is green on the same source.

P5 V3.1 exact-source GitHub verification on commit `17539ad56114432ee940ab640612f7983294515f`, fingerprint `2a546c4ead9510eb936220b2698f580569ef86d4fe32e950cbbe140503be6e26`, passed build/source regression and the P5 V3 Tailwind source audit, but Built Browser UAT exposed a real mobile POS geometry regression at 390x844 (`scrollWidth=410-421`). P5 V3.2 is a presentation-only root fix: the POS topbar stacks below `sm`, warehouse/actions are explicitly shrink/wrap-safe, and permanent UI-P3/P5 V3 audits reject the prior intrinsic-width pattern. R7/P5/R8-release/aggregate failures are downstream of this Browser blocker and are not patched independently. P6 remains blocked.

## P5 V3.3 Admin shell grid-placement root fix — 2026-09-26
- Human runtime screenshot after green V3.2 automation exposed a severe Admin composition regression: the sidebar rendered in the second desktop grid column while the main workspace auto-placed into a narrow first-column row, leaving most of the viewport blank.
- Root cause was not Tailwind cosmetics: `app-shell.tsx` used the outer `.shell` itself as the desktop grid and contained a literal `/* compatibility source marker: className=\"sidebar */` text node. That text became an anonymous CSS-grid item, shifting sidebar/main auto-placement even though overflow-only Browser checks remained green.
- V3.3 removes the literal marker, moves the desktop two-column grid into a dedicated `data-admin-layout=\"primary\"` wrapper with only semantic layout children, and makes `.main` explicitly full-width/min-width-zero.
- Browser UAT now verifies Admin sidebar/main geometry at 1440/1024/390, not merely horizontal overflow; source audit/tests reject outer-shell grid ownership or literal source-marker nodes. Business/API/domain authority remains frozen and P6 remains blocked pending exact-source automation plus Human Visual Acceptance.

## P5 FULL V4 total presentation rebuild — 2026-09-26

Human review rejected the V3/V3.3 runtime despite prior automated green because the suite still looked like a legacy skin and did not show a sufficiently clear modern product identity. The user explicitly overrode the prior restrained/no-gradient visual direction and required a total presentation rebuild based on external modern UI references rather than additional CSS patching.

V4 is therefore the active P5 candidate. It rebuilds the four product shells and compatibility presentation layers while freezing business/API/permission/domain authority. Admin now uses a semantic dark command sidebar with a bright floating workspace; POS is explicitly bright and touch-first; Storefront uses a warm premium retail identity; Employee Portal uses a distinct violet self-service identity.

Permanent gate upgrades add computed runtime visual-identity checks (`P5_V4_*_VISUAL_IDENTITY`) in Browser UAT and require them in `ci:p5:probe`, in addition to the existing screenshot matrix, responsive matrices and Admin semantic geometry. Human Visual Acceptance remains PENDING and P6 remains BLOCKED.

## P5 V4.3 — deterministic Next typecheck isolation

V4.2 local verification exposed a verification-infrastructure race in Next.js generated types: standalone TypeScript checks were reading `.next/dev/types` while `next typegen` generated `.next/types`. P5 V4.3 isolates all four Next workspaces from mutable development artifacts during lint/typecheck by using a shared runner plus `tsconfig.typecheck.json`. Presentation/business semantics are unchanged; P6 remains blocked pending V4 local visual acceptance and exact-source closure.
## 2026-09-26 — P5 V4.4 deterministic Next build ownership

V4.3.1 proved the prior isolation was incomplete: standalone lint/typecheck no longer consumed `.next/dev/types`, but `next build` still used the same `.next` tree and could ingest stale/live dev-generated route types. P5 V4.4 makes the shared Next workspace runner the authority for both typecheck and production build on all four Next products. Production build now fails early if a live `next dev` lock belongs to an active PID, otherwise removes only stale generated `.next/dev` before invoking `next build`, then verifies production `.next/types` exists and no dev type tree reappeared. No UI/business/API/domain contract is changed.

## 2026-09-26 — P5 V4.5 phase-isolated generated-type authority

The repeated Employee Portal production-build failures are traced to Next 16 generated-type ownership rather than application route source. The previous V4.3 standalone `tsconfig.typecheck.json` did not govern the real `next build`, while V4.4 cleanup alone did not make Next's own build type input phase-specific.

V4.5 uses the framework-supported custom TypeScript config boundary: each Next product keeps `tsconfig.json` for development and uses `tsconfig.build.json` for non-development Next phases via `next.config.mjs`. The production config extends the canonical config without overriding compiler options, includes only production `.next/types`, and excludes `.next/dev`. Development isolation remains enabled with `experimental.isolatedDevBuild=true`.

The shared verification runner refuses a live dev writer, removes generated `.next` before typegen/build, requires fresh production route types, rejects production `next-env.d.ts` references to `.next/dev/types`, and never patches generated files. `ignoreBuildErrors` remains false and all business/API/security/visual UAT contracts remain unchanged. P6 remains BLOCKED until full production build, localhost Human Visual Acceptance, and exact-source GitHub evidence pass.

## P5 V4.5.1 — production tsconfig selection hardening — 2026-09-27

- Root-cause hardening adds an explicit `T360_NEXT_VERIFY=1` verification authority in all four `next.config.mjs` files.
- Development server continues to use canonical `tsconfig.json`; deterministic verification/typegen/build is forced to `tsconfig.build.json` even if Next invokes config under a non-build phase.
- This does not relax compiler options: `tsconfig.build.json` still extends canonical `tsconfig.json`, overrides no `compilerOptions`, excludes `.next/dev/**/*`, and keeps `ignoreBuildErrors=false`.
- Official Next.js 16 configuration supports `typescript.tsconfigPath`. **Corrected 2026-09-29:** this line previously also claimed `experimental.isolatedDevBuild` was a supported boundary. It is not — the key was removed from Next.js, and `node_modules/next/dist/server/config-schema.js` in 16.3.5 contains no such key. Carrying it produced an "Unrecognized key(s) in object" warning on every dev start and build while isolating nothing. The four configs no longer set it, and the generated-type isolation test now asserts both that the key is absent and that the installed Next's own schema agrees it is gone. The dev/build split is carried entirely by `tsconfig.build.json` excluding `.next/dev/**/*`.
- No business/API/UI presentation contract changes. Real production build remains mandatory before operator artifact release.

## 2026-09-27 — P5 V4.5.2 Node ESM-safe Next config import

The first real operator production build after V4.5.1 exposed a config-loader regression before application compilation: Node ESM could not resolve the extensionless `next/constants` import from each `next.config.mjs`. The four Next product configs now import `PHASE_DEVELOPMENT_SERVER` from the concrete package file subpath `next/constants.js`, and the generated-type isolation regression test now asserts this exact ESM-safe contract.

This is verification-infrastructure hardening only. Generated-type ownership, strict TypeScript, `ignoreBuildErrors=false`, browser/UAT gates, and all business/API/security/tenant/domain/presentation behavior remain unchanged. Static verification after the fix is green (Next authority 9/9, dependency-free 999/999, full audit chain PASS). Real Admin/POS/Storefront/Employee production builds remain mandatory before Human Visual Acceptance or any commit/push.

## P5 V4.6 — Admin reference-dashboard root presentation rebuild — 2026-09-27

The V4.5.2 R3 production-build blocker is closed by operator evidence: all four Next 16.3.5 production builds passed. Human review then rejected the Admin runtime presentation even though prior P5 automation was green. That rejection is valid regression evidence for P5 because the visual gate proved only markers/geometry/luminance/overflow/screenshot existence and did not prove the accepted composition quality.

V4.6 repairs the presentation authority instead of adding another skin patch. The Admin default presentation now follows the supplied clean inventory-dashboard reference: light sidebar, search-first topbar, compact Dashboard Overview header, six colored KPI cards, line and donut analytics, recent activity, stock watchlist, and quick actions. A persisted light/dark toggle is part of the runtime contract. Shared semantic CSS classes still consumed across active Admin modules are restored under the same theme authority so non-Dashboard routes no longer fall back to unstyled legacy structures.

Automated P5 gates are strengthened to fail closed unless the six KPI cards, six named dashboard panels, line+donut identity, light default sidebar, working light/dark toggle, and shared semantic class coverage are present. Business/API/permission/domain authority remains frozen. P5 stays OPEN until Human Visual Acceptance; P6 and commit/push remain blocked.

## P5 V4.7 — Full UI root presentation and capability-exposure hardening — 2026-09-27

Human Visual Acceptance expanded the P5 regression from Admin appearance to the complete frontend product family. Deep source audit proved the previous visual gate could remain green while semantic JSX classes no longer had CSS authority, creating asymmetric grids, unstyled controls and inconsistent product shells even when build/tests passed.

V4.7 closes that root condition across Admin, POS, Storefront and Employee Portal without changing business/API/permission/domain semantics. Admin retains the reference-style light dashboard plus persisted dark mode; POS is light-first, tenant/branch-aware and exposes the existing canonical digital receipt; Storefront retains its light premium retail identity with semantic style coverage; Employee Portal becomes tenant-aware and keeps all seven configured views reachable on mobile.

The exhaustive backend/UI scan covers 36 API controllers and 451 handlers. F2/F3/F4/F5/F6/F7/F8/F11 are currently exposed in operator UI. F9 remains legitimately partial because external notification-provider production readiness is incomplete. F10 remains legitimately partial because a first-class operator assistant/AI capability is not implemented. `edge-sync.controller.ts` remains intentionally API-only for device/system synchronization.

A permanent `audit:ui:domain-depth` gate now joins P5 visual verification. It fails on missing required semantic class authority, POS dark-root regression, tenant-context omissions, hidden Employee mobile subdomains, missing digital-receipt exposure, direct no-op controls, permanent-disabled controls and unexpected API-only/partial capability drift. Real production build and Human Visual Acceptance remain mandatory before P5 closure; P6 remains blocked.

## 2026-09-27 — P5 V4.8.1 runtime-video root UI foundation

Human runtime screencast is now authoritative regression evidence for P5 presentation quality. The accepted repair boundary is shared presentation/layout authority across all four frontend products plus explicit Admin domain/subdomain discoverability, not additional page-specific CSS patches. Admin contextual subdomains are visible under the active primary navigation item and remain available in the complete module directory; POS is light-first; Storefront/Employee forms use canonical grid/label/button primitives; tenant/branch context remains explicit. Static deep scan covers 52 frontend source files, 36 controllers, 451 handlers and 63/63 Admin contextual destinations. P5 stays OPEN pending real four-app build and Human Visual Acceptance; P6 remains BLOCKED.

## 2026-09-27 — P5 V4.8.2 runtime-integrity root fix

Fresh Ubuntu runtime evidence exposed a real React invariant failure in Admin Integrations: `ExtensionsView` returned its loading skeleton before registering a later loyalty `useEffect`, so the loading transition changed the hook count between renders. The same duplicated bootstrap path also omitted the customer-directory request used by loyalty. V4.8.2 removes both root causes: commerce/extension bootstrap now has one canonical load/apply path, all `ExtensionsView` hooks are registered before conditional rendering, and the loyalty customer directory is part of that single extension snapshot.

The runtime screenshots also showed POS rendering the rejected dark/stale presentation while authored V4.8 source was light-first. V4.8.2 therefore makes development-output freshness part of the frontend authority rather than relying on operator cache state: all four Next workspaces start through `scripts/run-next-dev-workspace.mjs`, which validates the exact workspace Next version, deletes isolated `.next/dev` output before `next dev`, and forces development tsconfig authority (`T360_NEXT_VERIFY=0`). A permanent runtime-integrity test and `audit:ui:domain-depth` contract reject hook-after-loading-guard regressions, extension bootstrap drift, dev-script bypass, stale-dev-reset removal, and POS dark-root regression. P5 remains OPEN pending real four-app build and Human Visual Acceptance; P6 and commit/push remain blocked.

## 2026-09-28 — P5 V4.9 unified four-product root design system

V4.8.2 repaired the Admin React hook invariant and stale isolated-dev output, but Human Visual Acceptance still found inconsistent presentation ownership between products. V4.9 replaces product-local theme behavior with one presentation protocol across Admin, POS, Storefront and Employee Portal.

- Shared persisted theme authority: `toko360:ui-theme`.
- Default is deterministic LIGHT on every product; dark is entered only from explicit saved user selection.
- All four layouts bootstrap the saved theme before hydration and all four shells synchronize it to the document root.
- Admin, POS, Storefront and Employee Portal each expose a functional light/dark toggle while preserving their distinct product identity.
- POS may no longer become dark merely because the operating system prefers dark mode.
- The presentation wave does not add API/business-domain imports to shells or layouts and therefore does not change canonical business behavior.
- V4.8.2 hook-order and fresh `.next/dev` contracts remain active.

Server verification after V4.9 staging: focused root-design/runtime suite 55/55 PASS, dependency-free 1030/1030 PASS, workflow validation PASS, repository validation PASS (977 files / 180 Prisma models), product/Admin/canonical/P5/UI/full-repository audits PASS (451 API handlers / 401 controls). *(Counts are as of 2026-09-27; regenerate the file, API-handler, control and test counts with `npm run validate:repo`, `npm run audit:p5:visual` and `npm run test:dependency-free` rather than quoting them here.)* Frontend API-call signatures match the V4.8.2 baseline across all 25 files that contain API calls, and apps/api, apps/worker, packages, and database have zero source changes. Real production builds and Human Visual Acceptance remain pending on the Ubuntu operator environment. P5 remains OPEN; P6, commit and push remain blocked.

## P5 V4.10 — product-scoped theme integrity and safe Next bootstrap — 2026-09-28

Runtime screenshots invalidated the V4.9 shared-theme assumption. One global theme key caused cross-product leakage (a dark choice in Storefront/Admin could make POS dark), and raw `<script>` tags inside all four React root layouts produced a real runtime console error in Employee Portal. V4.10 isolates theme persistence per product, retains deterministic LIGHT default, switches pre-hydration bootstrap to `next/script` `beforeInteractive`, adds login-surface theme controls where the authenticated shell is absent, and neutralizes Storefront dark mode to charcoal/emerald instead of full-green.

No business/API/permission/domain implementation changes are included. Admin domain/subdomain authority remains 14 primary / 63 contextual. Static server gates are green (focused 66/66; dependency-free 1035/1035; workflow/repository/product/Admin/canonical/P5/UI/full-repository PASS). Real four-product Next build and explicit Human Visual Acceptance on Ubuntu are still required before commit/push or P6.

## 2026-09-29 — POST-1C audit: revoke-binding was unreachable, and a removed Next key was carried

Two real defects found while continuing work in the `test` copy, both fixed in product code with
negative controls.

**1. The "Cabut" (revoke) button on the Mobile Ops screen could never work.** `mobile-ops.tsx` sent
`{ platformUserId: revokeTarget.id }`, but `revokeTarget.id` is the binding row id, and
`listBindings` deliberately never returns `platformUserId` — it is credential-adjacent and the
service says so in a comment. The service then looked the record up by `platformUserId`, so every
revoke resolved to nothing and returned 404. The operator's only remedy would have been a support
ticket. Revocation is now keyed on the binding's own row id, still tenant-scoped
(`where: { id: bindingId, companyId }`), so a binding id from another company still resolves to
nothing. The security posture is unchanged and slightly better stated: the platform identity is
neither sent by the screen nor required by the route.

Regression: `tests/post1c-mobile-ops-security.test.mjs` gained `revoke is addressed by a key the
operator screen actually holds`, which parses the UI's revoke payload and the route's DTO and
requires them to name the same thing. Negative control: restoring the old UI payload, and separately
restoring the old service lookup, each turn the suite red (2 and 2 tests).

**2. All four `next.config.mjs` carried `experimental.isolatedDevBuild`, a key Next.js no longer
has.** Next 16.3.5 prints "Unrecognized key(s) in object: 'isolatedDevBuild'" on every dev start and
build, and `node_modules/next/dist/server/config-schema.js` contains no such key — so it isolated
nothing. The real dev/build split in this repo is `tsconfig.build.json` excluding `.next/dev/**/*`,
which was already enforced. The key is removed from the four configs, the machine contract records it
as `false`, and the isolation test now asserts the key is absent *and* that the installed Next's own
schema agrees it is gone — so if Next ever reintroduces it, the gate fails loudly instead of quietly
demanding the wrong thing. The P5 V4.5.1 note in this file claiming the key was a supported boundary
is corrected in place.

Negative control: reintroducing the key into one config turns 2 tests red.

No business, API, permission or tenant-scope semantics changed. Commit and push remain the owner's.
## 2026-10-03 — Pre-GitHub source-hardening reconciliation

The stale source gaps recorded after the 2026-09-29 audit are closed before GitHub UAT. Order creation and operational-finance creation now require a stable client operation key and fail closed on missing/mismatched keys; Storefront/POS preserve retry identity and the staging integration runner verifies order replay. Payroll component and employee-component reads are cursor-paginated, with bounded candidate scanning and branch validation instead of loading the whole active employee set.

F10 is no longer a legitimate PARTIAL capability at source level: explainable forecast/reorder, a deterministic permission-scoped operator assistant, anomaly insight, confidence/source links, interaction history and human-confirmation guardrails are implemented. Canonical F10 status is `IMPLEMENTED_RUNTIME_PENDING`; this does not claim an external LLM provider. F9 remains `PARTIAL` because live external notification-provider production readiness requires provider configuration/credentials and runtime evidence. `edge-sync` remains intentionally API-only.

P5 remains `IMPLEMENTED_RUNTIME_PENDING`, `humanStage20=PENDING`, and `productReady=false`. The next authority is exact-source GitHub UAT: dependency install/build, PostgreSQL authenticated multi-role mutation/replay/concurrency, four-Next production/browser matrix, then explicit Human Stage-20. No source-only result may promote product readiness.


## 2026-10-12 — GitHub UAT red after work item closure: root cause and repair

`main` was red on both PostgreSQL GitHub workflows (runs `38086561199` Full Automated UAT and
`38086561205` Full System Simulation, commit `0230b58`). The reported failures were ~30 downstream
UAT steps; the single first blocker was `STEP_BUILD`:
`Build gate FAIL — REGRESSION_TESTS gagal dengan exit code 1` with `# pass 1802 / # fail 3`.

**Root cause.** Commit `6715f1c` moved nine work items to `STAGING` and `0230b58` moved the same
nine from `work-items/active/` to `work-items/completed/` with `phase: CLOSED`. Three test files were
never updated for either transition:

- `tests/p6a-retail-transaction-completion.test.mjs` — `ENOENT` on
  `work-items/active/T360-20261005-154000-p6a-retail-transaction-completion.json`
- `tests/recovery-r0-48-finding-coverage.test.mjs` — `ENOENT` on
  `work-items/active/T360-20260923-221011-full-ui-tailwind-and-github-uat-expansion.json`
- `tests/video-parity-expansion.test.mjs` — `ENOENT` on
  `work-items/active/T360-20261004-184500-video-parity-expansion.json`

and all three also asserted `phase === 'VERIFICATION'`, which stopped matching as soon as the items
advanced. Because the build gate runs `npm test`, three test-file errors took out the six-app build,
which took out every artifact-dependent UAT step, Stage-18/19/20, and the UAT candidate
fail-closed assertion.

**Repair (work item `T360-20261012-011530`, phase VERIFICATION).**

- New `tests/helpers/work-item.mjs` resolves a work item from `work-items/active/` or
  `work-items/completed/`, fails closed when it is in neither, and fails closed when the same file
  exists in both. The phase assertion is replaced by `assertDeliveredWorkItem`, which requires a
  delivered phase (`RELEASE_READY|RELEASED|CLOSED`), `releasedAt`, `closedAt`, and a release evidence
  entry under `handoff/release-evidence/` that exists on disk — strictly stronger than the old
  hardcoded `VERIFICATION` equality.
- Second, independent defect: the nine work items closed in `0230b58` stored `releaseEvidence` as a
  single string pointing at `handoff/release-evidence/<id>.md`, but the committed evidence files are
  named `<id>-<slug>.md`, and every other work item in the repository stores `releaseEvidence` as an
  array. All nine now store the array form naming the file that actually exists.
- New `tests/work-item-path-resolution.test.mjs` scans every `tests/*.test.mjs` for
  `work-items/{active,completed}/<file>.json` literals and fails if any resolves to no real work
  item, so a future closure cannot silently break the suite before it reaches GitHub CI.

**Not claimed.** The Stage-20 `PrismaClientInitializationError` seen in run `38086561199`
(`apply-stage20-critical-indexes.mjs` seeing a SQLite-generated client) was a *consequence* of the
build gate aborting before `PRISMA_GENERATE_POSTGRES_FINAL`; it is not an independent defect and was
not "fixed" separately. Local evidence: `test:dependency-free` 1821/1821 PASS, `workflow:validate`
PASS (46 work items), `validate:repo` PASS (1191 files / 202 Prisma models), `lint` PASS. GitHub
green on both workflows is still pending until the runs finish.

P5 remains `IMPLEMENTED_RUNTIME_PENDING`, `humanStage20=PENDING`, `productReady=false`, and R8
(`T360-20260925-143000`) remains BLOCKED. Nothing here advances canonical product readiness.

## 2026-10-12 — F11 purchase-side UOM: request, barcode, receiving scan, runtime evidence

Work item `T360-20261012-012923` (phase STAGING). F11 was the only phase in
`config/functional-depth-roadmap.json` still marked `NEXT_SOURCE_IMPLEMENTATION`.

**What was actually broken.** `PurchaseOrderItem` and `GoodsReceiptItem` already converted and
snapshotted purchase UOM correctly, but `PurchaseRequestItem` had no UOM column at all. So
`purchase-requests.service.ts` built every PO line as `{ productId, orderedQty: item.quantity, unitCost }`
with no `productUnitId`: an operator asking for "3 karton" got a purchase order for 3 *base* units.
The approval amount had the same shape problem, because `estimatedUnitCost` had no stated unit.

**Second defect, found by running the service rather than reading it.** Goods receipt inspection
evidence incremented `scannedQty` by a hardcoded `1`. `InspectionResultItem.expectedQty` is canonical
base quantity, so receiving 2 cartons of 24 meant scanning the same carton 48 times, and the row pick
`(scannedQty ?? 0) < (expectedQty ?? 0)` let a final scan push `scannedQty` past `expectedQty`.
Scanning now uses the scanned barcode's own conversion factor and only selects a line whose remaining
capacity fits that unit.

**Third defect.** The F11 gap text in `scripts/run-f1-backend-ui-audit.mjs`, its generated mirrors
(`config/f1-backend-ui-audit.json`, `config/p5-full-ui-root-audit.json`, `docs/F1-BACKEND-UI-AUDIT.md`,
`docs/P5-FULL-UI-ROOT-AUDIT.md`) and `handoff/quality/ui-domain-surface-depth-latest.json` all asserted
that PO and goods receipt lack first-class purchase UOM. That was contradicted by
`purchase-orders.service.ts` and `goods-receipts.service.ts` and had been for some time. Corrected in
the generator and regenerated, so the audit cannot drift back.

**Change.** New `apps/api/src/common/purchase-uom.ts` is the single purchase-side resolver
(`resolvePurchaseUnitLine`, `toPurchaseBaseQuantity`, `toPurchaseBaseUnitCost`), mirroring
`common/transaction-uom.ts` on the selling side: base unit must be active in the company UNIT master,
ProductUnit activity and variant match, barcode/ProductUnit conflict, integer-safe factor, factor > 1
implies a different unit code, safe-integer base quantity. Purchase request, purchase order and goods
receipt all use it, so factor arithmetic can no longer drift between the three documents.

`PurchaseRequestItem` gains an immutable snapshot — `unitQuantity`, `quantityFactor`, `unitCode`,
`productUnitId`, `variantId`, `sourceBarcode` — through expand-only migration
`database/migrations/T360-20261012-f11-purchase-uom-request/` (SQLite + PostgreSQL, registered in
`config/expand-migration-order.json`). `quantity` stays canonical base. `estimatedUnitCost` is now
explicitly per purchase unit and the approval amount is `estimatedUnitCost * unitQuantity`; legacy rows
carry factor 1 and a null `unitQuantity`, so their arithmetic is unchanged. `convert()` forwards the
snapshot. PO and PR also accept a purchase `barcodeCode` that must resolve to the same product.

**Evidence.** `tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs` is a real runtime test,
not a source regex: against SQLite with the actual services it proves 3 karton request → 72 base PO,
barcode resolution, 2 karton received with 1 damaged → 48 received / 24 damaged / 24 accepted, stock
and a single append-only movement, a balanced `PURCHASE_RECEIPT_CREDIT` journal whose inventory basis
is the base unit cost and whose input tax is computed from base net, snapshot immutability after the
master factor is edited to 99, and factor-aware inspection scanning including rejection of an overshoot.

Three existing gates asserted the old inline arithmetic and were rewritten to pin the new invariant
rather than deleted. Migration rehearsal was executed, not asserted: PASS against a real PostgreSQL
16.15 container and a real SQLite database, applying the new migration on top of the previous commit's
schema and matching the full schema contract.

Local: `test:dependency-free` 1827/1827 PASS, workspace tests PASS, `lint` PASS, `workflow:validate`
PASS (47), `validate:repo` PASS (1198 files / 202 Prisma models), `audit:full:repo` PASS (7 audits),
`ci:ui:audit` PASS (514 controls).

**Not claimed.** F11 is now `SOURCE_IMPLEMENTATION_COMPLETE_UAT_DEFERRED`, which is a source statement
only. P5 remains `IMPLEMENTED_RUNTIME_PENDING`, `humanStage20=PENDING`, `productReady=false`, and R8
(`T360-20260925-143000`) remains `BLOCKED`. Nothing here advances canonical product readiness.

## 2026-10-14 — R8 automated layer closed; the remaining critical path is human, not code

Work item `T360-20260925-143000` (R8, `release-uat`, W7, HIGH) moved
BLOCKED → VERIFICATION → STAGING → RELEASE_READY → RELEASED → CLOSED.

**Why it was BLOCKED and why that was stale.** The item was created already in `BLOCKED` on
2026-09-25. Its only documented blocker — `docs/R8-GITHUB-FULL-RUNTIME-UAT.md` and the work item's own
business rule — is exact-source R7 PASS. R7 (`T360-20260923-221011`) closed on 2026-10-11, and the
exact-source R7 gate then passed *inside* the R8 probe chain on current source.

`config/workflow-policy.json` gives `phaseOrder.BLOCKED = 99`, so `scripts/workflow.mjs` refuses any
advance out of BLOCKED. Its error prescribes the remedy — "Gunakan work item baru atau dokumentasikan
rollback fase secara manual" — so the rollback to `VERIFICATION` was performed manually and the
justification is written into the work item's `businessRules`. The guard was not weakened.

**Evidence basis.** Exact-source GitHub runs on commit `0f4b38d`: Full Automated UAT `38545068254`,
Full System Simulation `38545068348`, Workflow Governance `38545068220`, all success. `ci:r8:probe`
returned `PASS` with `scenarioCount 12` and 12/12 PASS, `sourceIdentity`
`019b50aacbebd12a4e97ad7a362f1276a20a2379301c8d53bac0425123e82fa5` (913 files), `buildArtifactId`
`0a42c8007b4e485622552c7c9b939e7c9290e90066eaae270608583d7e45dde1`, `productionTouched false`,
`humanStage20 PENDING`; `STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING`; and
`UAT candidate fail-closed assertion PASS: hanya Human Stage-20 yang masih pending.`
Local test plan: `tests/recovery-r8-runtime-uat.test.mjs` 10/10, `audit:recovery` 48/48 mapped
(0 unmapped, 202 models, 532 handlers, 514 controls), `test:dependency-free` 1827/1827, lint,
`workflow:validate` (47), `validate:repo` (1198 files / 202 Prisma models), `audit:full:repo` (7),
`ci:ui:audit` (514). All seven acceptance criteria map to a line of evidence in
`handoff/release-evidence/T360-20260925-143000-recovery-r8-runtime-uat.md`.

**A limitation I am disclosing rather than papering over.** While auditing the R8 gate I found that
`scripts/ci-r8-release-evidence-probe.mjs:47-53` builds the twelve critical scenarios from a *static*
`id → evidence-ref` table stamped `PASS`, and hardcodes `exactSource`, `r8ReportingSecurity`,
`executedCriticalScenarios` (`scenarios.length === 12`) and `humanStage20Pending`. Lines 33-45 do
enforce the substance — every referenced artifact must report PASS and every artifact carrying a
`sourceIdentity` must match the current fingerprint or the probe throws — but
`if (s && s !== source.value)` **skips the staleness check entirely** for an artifact that has no
`sourceIdentity` at all.

No false PASS occurred here: all thirteen source-carrying artifacts matched. But this is precisely
post-audit finding **A-02 (CRITICAL, P0) "Audit/test design can report green while product
incomplete"**, still open, and R8 closure is explicitly not evidence that A-02 is resolved. A-02 is
the next intake.

**The critical path is now human, not code.** `config/product-completeness.json` carries two gates
that automation cannot satisfy: "P5 cannot close and P6 cannot start until a human explicitly accepts
the runtime presentation after automated exact-source PASS", and "P5 V4 human visual acceptance is
explicitly recorded only after the local runtime is visibly accepted and exact-source automation
passes; only then may P6 start." The V4 automated evidence is green. The human visual acceptance has
been **rejected twice** (V1, V2) and is currently `PENDING`.

**Not claimed.** `productReady` stays `false`, `currentPhase` stays `P5` / `IMPLEMENTED_RUNTIME_PENDING`,
`humanStage20` stays `PENDING`. R8 closure covers the automated evidence layer only; it neither
records nor implies human visual acceptance, and no automated probe may mutate it. Canonical matrix is
unchanged at 48 features = 27 FOUNDATION, 3 PARTIAL, 17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED,
with 8/15 post-audit findings RUNTIME_VERIFIED.

## 2026-10-14 — A-02: two demonstrated vacuous-green instances closed, finding kept open

Work item `T360-20261014-183210` (A-02 hardening, `bug`, W0 `audit`, CRITICAL), currently
IMPLEMENTATION. This entry records what changed and, more importantly, what deliberately did **not**
change.

**Why A-02 at all.** Closing R8 forced me to read the gate that produced its evidence. It did not
read like what its output claimed:

- `scripts/ci-r8-release-evidence-probe.mjs` built the twelve critical UAT scenarios from a **static**
  `id → evidence-ref` table whose rows were stamped `PASS`, and emitted
  `executedCriticalScenarios: scenarios.length === 12` — a comparison of a table against its own
  length. `exactSource`, `r8ReportingSecurity` and `humanStage20Pending` were boolean literals.
- `if (s && s !== source.value)` **skipped the stale-source check entirely** for any artifact that
  arrived without a `sourceIdentity` field, so an artifact carrying no identity at all was accepted
  as long as it said `status: 'PASS'`.
- Independently, `scripts/audit-product-completeness.mjs` closed the evidence question with
  `!(item.evidence?.length)` — array length. `feature:pos_offline` was `RUNTIME_VERIFIED` on
  `evidence: ["historical automated evidence only"]`, and `audit:A-01` on a single prose sentence,
  while `docs/PRODUCT-COMPLETENESS-STATUS.md` states that `RUNTIME_VERIFIED` requires exact-source
  runtime evidence.

Those are three ways for a gate to be green without saying anything. That is A-02, verbatim.

**What changed.**

- New `scripts/lib/r8-evidence-binding.mjs`: `assertSourceBinding` fails closed when an artifact has
  no `sourceIdentity` unless it is listed in `SOURCE_BINDING_EXEMPTIONS` **with a rationale of at
  least 20 characters**; `evaluateScenarioCoverage` derives scenario coverage from artifacts that are
  actually `PASS` *and* fingerprint-matched; `declaredProductionTouched` collects any artifact that
  reports `productionTouched: true`.
- `scripts/ci-r8-release-evidence-probe.mjs` now derives `exactSource`, `exactBuildArtifact`,
  `executedCriticalScenarios`, `r8ReportingSecurity` and `humanStage20Pending` from evidence it read,
  and **throws** if any of the twelve scenarios loses an artifact or points at an unbound one. The
  output schema is unchanged, so `ci-write-full-system-summary.mjs` and `github-uat-report.mjs` keep
  working.
- New `scripts/lib/evidence-resolver.mjs` plus the audit: evidence must classify as a repository file
  that exists, a **registered** CI artifact that a script under `scripts/` really produces,
  `logs_<run>.zip`, or `source-commit:<sha>`; prose fails. `RUNTIME_VERIFIED`/`HUMAN_ACCEPTED` must
  also carry a concrete anchor. The new `runtimeEvidenceArtifacts` registry is validated in both
  directions — every entry must be produced by a script, and must **not** be tracked in the repo.
- `feature:pos_offline` is now bound to `handoff/quality/github-r3-residual-probe-latest.json`, the
  artifact whose probe really executes sync receipt, offline transaction, device diagnostics, ack and
  requeue on PostgreSQL and that `ci:r8:probe` re-binds to the current fingerprint as
  `UAT-08-OFFLINE-SYNC`. `audit:A-01`'s prose was split into `source-commit:` + three log archives,
  with the narrative moved to `evidenceNotes` where it belongs.
- New `tests/vacuous-green-gate.test.mjs` (11 tests): prose is rejected, a declared-but-unproduced
  artifact is rejected, logs without a source commit are rejected, missing/stale/short-exemption
  bindings all throw, coverage is derived rather than counted, and the real audit still passes.

**One test expectation was changed, deliberately.**
`tests/recovery-r8-runtime-uat.test.mjs` asserted `/r8ReportingSecurity:true/` — it demanded the
constant. That expectation is the defect, so per the master workflow's root-cause rule it was
replaced with the new contract: the check must be derived from `r8ReportingCheckValues` and must not
be a literal. No assertion was weakened; the bar moved up.

**Why A-02 is not closed.** The canonical status stays `IMPLEMENTED_RUNTIME_PENDING` and I will not
touch the string. A scan of every `checks` literal under `scripts/` found **zero** remaining
all-literal checks objects, and the probes that emit `status: 'PASS'` (`ci-r1`, `ci-r2`, `ci-r4`,
`ci-r6`, `ci-p2`, `ci-p3`) are fail-fast — they throw on the first failed expectation — or are
downstream-enforced by `Object.values(checks).every(Boolean)` in the summary gate. So no third
instance was demonstrated, but "no third instance found" is not proof that none exists across every
audit in the repository. A-02 closes when a full sweep can say that with evidence, not because two
instances were fixed.

**Not claimed.** `productReady=false`, `currentPhase=P5`, `humanStage20=PENDING`. No business logic,
API, permission, schema or runtime path changed; this is verification-layer only. Local:
`test:dependency-free` **1838/1838** (was 1827, +11 new), lint PASS, `workflow:validate` PASS (48),
`validate:repo` PASS (1204 files / 202 Prisma models), `audit:full:repo` PASS (7), `audit:recovery`
48/48, `audit:product:completeness` PASS, `audit:canonical:ownership` PASS, `ci:ui:audit` PASS (514).
GitHub evidence for the hardened probe executing on both heavy workflows is the pending acceptance
criterion.

**Closed.** `T360-20261014-183210` moved IMPLEMENTATION → VERIFICATION → STAGING → RELEASE_READY →
RELEASED → CLOSED with evidence in
`handoff/release-evidence/T360-20261014-183210-a-02-harden-audit-and-test-gates-against-vacuous-green.md`.

Exact-source GitHub verification on commit `1256c01`: Workflow Governance `38553931267`, Full System
Simulation `38553931368`, Full Automated UAT `38553931228`, all success. The hardened probe ran and
reported `status PASS`, `scenarioCount 12`, `sourceIdentity 65ac7d665ffa31fd…` (916 files),
`productionTouched false`, `humanStage20 PENDING`, and all eight checks **derived** — `exactSource`,
`exactBuildArtifact`, `executedCriticalScenarios`, `r8ReportingSecurity`, `safeBrowserMutationJourneys`,
`providerChain`, `loadIndependentHumanGate`, `humanStage20Pending`. `STEP_R7_UI`, `STEP_BUILT_BROWSER`,
`STEP_R8_REPORTING_SECURITY`, `STEP_R8_RELEASE`, `STEP_STAGE20` and `STEP_CANDIDATE` all success with
`STAGE20_MODE: AUTOMATED_PASS_HUMAN_UAT_PENDING`.

**A-02 stays open.** Two instances closed, zero remaining all-literal `checks` objects found in a
bounded scan, `status` untouched at `IMPLEMENTED_RUNTIME_PENDING`. The next item on this thread is the
full sweep that would actually justify closing it.

**No work item is currently active.**

## 2026-10-14 — A-09 + A-12 closed on a general hygiene rule

Work item `T360-20261014-113115` (security, W0, HIGH), CLOSED with evidence in
`handoff/release-evidence/T360-20261014-113115-a-09-a-12-generalise-tracked-hygiene-gate.md`.

**The gate that was supposed to close them was itself an A-02 instance.**
`scripts/audit-product-completeness.mjs` enforced "no tracked credential, no tracked runtime
evidence" with four expressions: one literal env path
(`payroll-adjustment-postgres-stage.env`), `*.recovery-backup`, `handoff/quality/*.{json,md}`, and
**three named** `logs/` subdirectories. `staging.env`, `server.pem`, `secrets.json` or
`logs/uat-anything/probe.json` would all have been reported PASS. Closing A-09/A-12 on top of that
would have been a status string, not evidence — so the rule was generalised first.

**New `scripts/lib/tracked-hygiene.mjs`.** Env file at any path (unless `.example`), key and
credential-container files, generated `handoff/quality` artifacts, **every** path under `logs/`,
recovery backups by name, and content rules — private keys and provider tokens in every tracked
file, connection strings with non-placeholder passwords outside fixtures. Escaping requires a
path-scoped, rule-scoped exemption with a rationale of at least 20 characters; `HYGIENE_EXEMPTIONS`
ships empty and a test asserts it stays empty.

**Measured, not assumed.** A repository scan found 19 tracked files containing a connection string;
every password is a placeholder (`CHANGE_ME_*`, `USER`/`PASSWORD`, `toko360`,
`toko360_ci_password`, `schema_check`, `secret`, `p`), and no private key, AWS key, GitHub token or
OpenAI key exists in tracked content. No exemption was needed, so none was granted. The two
non-placeholder passwords are `alice:p%40ss` in test fixtures, handled by a documented tier rule
rather than a per-path escape.

**Assertions.** The test demanding the literal `payroll-adjustment-postgres-stage.env` asserted the
defect and was converted to behaviour-level controls; `tests/product-completeness-p0.test.mjs` now
validates CRITICAL/HIGH finding evidence through `validateEvidenceArray` instead of checking
`evidence.length`, so a prose sentence no longer satisfies `runtimeEvidenceRequiredForCriticalHigh`.

**Closed.** A-09 (HIGH) and A-12 (MEDIUM) → `RUNTIME_VERIFIED`, evidence =
`source-commit:5692b19bd1259bfda387eb4b66ac87115b5e5c51` + `logs_38558772478.zip` +
`logs_38558772502.zip` + the implementation file + its regression test. Both GitHub heavy workflows
executed the generalised rule through `audit:full:repo`: Governance `38558772486`, Automated UAT
`38558772478`, Full System Simulation `38558772502`.

**A first Simulation attempt failed on infrastructure, not on this change.**
`uat:browser:built` reported *"Chrome menolak start (bukan timeout) — dbus: Failed to connect to the
bus"*, then `ci:r7:probe` and `ci:p5:probe` failed closed because browser evidence was not `PASS`,
then `ci:r8:probe` failed because `github-r7-ui-probe-latest.json` never existed. The rerun passed
end to end with no code change. The fail-closed chain behaved exactly as designed.

**Open findings: 5 of 15** — A-02 (CRITICAL), A-07 (HIGH), A-13, A-14, A-15 (MEDIUM). A-02 stays
`IMPLEMENTED_RUNTIME_PENDING`: one more narrow gate was removed, which is not proof that none
remains. Canonical matrix otherwise unchanged: 48 features = 27 FOUNDATION, 3 PARTIAL,
17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED; `productReady=false`, `currentPhase=P5`,
`humanStage20=PENDING`. Local: `test:dependency-free` **1850/1850** (+12), lint,
`workflow:validate` (49), `validate:repo` (1208 files / 202 Prisma models), `audit:full:repo` (7)
— all PASS.

## 2026-10-14 — A-02 CLOSED: third instance removed, continuous control added

Work item `T360-20261014-123151` (bug, W0, CRITICAL), CLOSED with evidence in
`handoff/release-evidence/T360-20261014-123151-a-02-part-2-gate-inventory.md`.

**Instance three.** Fourteen of the fifteen checks-based predicates in
`scripts/ci-write-full-system-summary.mjs` evaluated `Object.values(v.checks || {}).every(Boolean)`.
Because `[].every(Boolean)` is `true`, a probe emitting `status: 'PASS'` with `checks: {}` would have
been accepted by the aggregate gate and `ci:summary:github:assert` — which only reads
`summary.failures.gates` — would have seen an empty failure list. Only `w3CashPostgres` required a
minimum key count. Predicates now share `allChecksPass(v)`: at least one check **and** all true.

**Why the finding can close now.** Fixing instances one at a time is not a close.
`scripts/lib/gate-inventory.mjs` enforces the property instead: every `scripts/**/*.mjs` that emits
`status: 'PASS'` must be mechanically bound to something that can fail the build — fail-fast checks
loop, assert helper, three or more inline throws, an assertion export that throws, a workflow step
that runs it, or an artifact the aggregate summary gates read. The mechanism is **proven by parsing
the file**, never declared in prose, and classification is derived on every run so there is no stored
registry that can go stale. Measured before the rule was written: **28 of 28** PASS-emitting files
classify with **zero exemptions**.

**Behavioural controls.** `tests/gate-inventory.test.mjs` (4 tests) reports a synthetic rogue
emitter and pins every mechanism marker. `tests/github-full-system-summary.test.mjs` gained the
negative control: six checks-based gates fed `status:'PASS'` with a matching `sourceIdentity` and
`checks:{}` must each report `FAIL`, and the same gate with one real check must report `PASS` — the
bar moved up without breaking the happy path.

**One expectation proven stale.**
`tests/product-completion-p2a-runtime-gate.test.mjs` demanded the literal
`Object.values(v.checks || {}).every(Boolean)` in the summary source: it asserted the defect. It now
demands `allChecksPass(v)` and asserts the old expression never returns. Nothing was weakened.

**Closed.** A-02 (CRITICAL) → `RUNTIME_VERIFIED`, evidence =
`source-commit:d6c54877cd69aa80b409ea1e68d8239ccc694938` + `logs_38566522222.zip` +
`logs_38566522268.zip` + the inventory module, its test, and the first item's binding module and
controls. Exact-source GitHub on `d6c5487`: Workflow Governance `38566522526`, Automated UAT
`38566522222` (9m22s), Full System Simulation `38566522268` (8m23s) — all success.

**Open findings: 4 of 15** — A-07 (HIGH, requires human Stage-20 acceptance), A-13, A-14, A-15
(MEDIUM). Canonical matrix otherwise unchanged: 48 features = 27 FOUNDATION, 3 PARTIAL,
17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED; `productReady=false`, `currentPhase=P5`,
`humanStage20=PENDING`. Local: `test:dependency-free` **1855/1855** (+5), lint,
`workflow:validate` (50), `validate:repo` (1212 files / 202 Prisma models), `audit:full:repo` (7)
— all PASS.

---

## 2026-10-14 — A-14 CLOSED — undated live counts removed from governance prose

`T360-20261014-131512` (`documentation`, W0, `MEDIUM`, dependency `T360-20261014-123151`) is
CLOSED. The finding was `audit:A-14`, "status/governance documents conflict or lag current
evidence".

**The defect was a class, not a typo.** Prose that says *currently*, *current count is*, *live
counts are*, *current figures are* or *now reports* carries a number that is true when written
and false at the next commit. Measured before the fix, nine such lines existed:

| File | Line | Stale claim (paraphrased; the exact wording is preserved only in `handoff/release-evidence/`) |
| --- | --- | --- |
| `STATUS-FINAL.md` | 3 | 4 active work items, 1089 tests, and a false claim that the tree had no `.git` |
| `docs/PROJECT-STATE.md` | 3 | 36 controllers / 454 handlers / 180 models / 63 destinations / 420 controls / 1089 tests |
| `docs/PROJECT-STATE.md` | 5 | a false claim that this copy had no `.git` |
| `docs/PROJECT-STATE.md` | 246 | 1021 files, 454 API handlers, 420 controls, 1089 dependency-free tests |
| `docs/F12-FINAL-UI-UX-COMPLETION.md` | 31 | a file count of 1021 |
| `docs/COMPLETION-DOCS-INDEX.md` | 34 | 454 routes, payroll 30, platform 41 |
| `docs/COMPLETION-DOCS-INDEX.md` | 38 | 454 routes and 420 controls |
| `docs/COMPLETION-DOCS-INDEX.md` | 14 | 509 handlers, 195 models, 65 destinations, plus the same false `.git` claim |
| `docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md` | 83 | 63 of 63 contextual views |

The counting rule in `docs/PROJECT-STATE.md` was the worst offender: it announced the canonical
counting rule and then broke it in the same sentence.

**Business rule.** Counts belong to machines. A document may name the command or file that
regenerates a number, and may record a number that is explicitly dated as a historical fact; it
may not assert an undated current value.

**Guard, deliberately narrow.** `tests/status-doc-currency.test.mjs` fails on a line that
matches one of a **curated** live-claim phrasing *and* contains a digit. A generic number scan
was measured first and rejected: it flagged 10 lines, three of which were dated records or
harmless prose. The curated list flags exactly the nine real defects and nothing else. A
A separate rule rejects any prose asserting the working copy lacks `.git`; that claim was
repeated in three files and is false in this repository.

**One expectation proven stale.** `docs/PROJECT-STATE.md:3` and `STATUS-FINAL.md:3` both
asserted the working copy had no `.git`; the repository does. Both were rewritten to a timeless
instruction to verify against `git log`.

**Closed.** `audit:A-14` (MEDIUM) → `RUNTIME_VERIFIED`, evidence =
`source-commit:b2f96bc` + `logs_38572274675.zip` + `logs_38572274795.zip` +
`tests/status-doc-currency.test.mjs` +
`handoff/release-evidence/T360-20261014-131512-a-14-doc-live-count-currency.md`. Exact-source
GitHub on `b2f96bc`: Workflow Governance `38572274826`, Automated UAT `38572274675` (8m05s),
Full System Simulation `38572274795` (8m06s) — all success.

**Open findings: 3 of 15** — A-07 (HIGH, requires human Stage-20 acceptance), A-13, A-15
(MEDIUM). Canonical matrix otherwise unchanged: 48 features = 27 FOUNDATION, 3 PARTIAL,
17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED; `productReady=false`, `currentPhase=P5`,
`humanStage20=PENDING`. Local: `test:dependency-free` **1859/1859** (+4), lint,
`workflow:validate` (51), `validate:repo` (1215 files / 202 Prisma models), `audit:full:repo` (7)
— all PASS.

**Phase-skip hole found during close, out of scope for A-14.** `workflow:advance` only rejects
a phase whose order is *lower* than the current one; it does not require the next phase in
sequence. This item therefore went STAGING → RELEASED → CLOSED without passing `RELEASE_READY`,
whose `releaseEvidence` check never ran, and the item's `releaseEvidence` array had to be
backfilled after close. Same class as A-02: a gate that can be bypassed by skipping the step
that would have enforced it. A separate work item must make `commandAdvance` require
`nextOrder === currentOrder + 1` (BLOCKED excepted) so no phase can be skipped.

---

## 2026-10-14 — W-01 CLOSED — workflow:advance cannot skip a phase

`T360-20261014-140446` (`bug`, W0 `workflow`, `MEDIUM`, dependency `T360-20261014-131512`) is
CLOSED. This is a new process finding, not one of the original 15 post-audit findings; it was
discovered while closing A-14 and is closed on its own merit.

**The defect was demonstrated live.** `commandAdvance` only rejected a phase whose order was
*lower* than the current one, so an item at `STAGING` could jump to `RELEASED`, skipping
`RELEASE_READY` and its `releaseEvidence` check. A-14 took exactly that jump; the check never
ran and the item's evidence array had to be backfilled after close.

**Rule, derived from the policy file.** A non-`BLOCKED` advance must land on the immediate
successor in `config/workflow-policy.json` `phaseOrder`. `BLOCKED` stays reachable from any
phase and stays a dead end, matching the documented manual path for a blocked item. The error
names the phase that was skipped over, so the operator learns the missing step rather than
just a rejection.

**Control.** `tests/workflow-phase-order.test.mjs` drives the real CLI against a scratch copy
of the repository — no committed work item is mutated. Negative: `STAGING → RELEASED` rejected
(naming `RELEASE_READY`), `RELEASE_READY → STAGING` rejected, `BLOCKED → any phase` rejected.
Positive: `STAGING → RELEASE_READY` succeeds once the evidence file resolves, `any phase →
BLOCKED` succeeds. The `RELEASE_READY` gate is now reachable on every path to `CLOSED`.

**Closed.** Process finding W-01 → fixed; evidence =
`source-commit:25183b4` + `logs_38579364527.zip` + `logs_38579364562.zip` +
`tests/workflow-phase-order.test.mjs` +
`handoff/release-evidence/T360-20261014-140446-w-01-workflow-phase-order.md`. Exact-source
GitHub on `25183b4`: Workflow Governance `38579364606`, Automated UAT `38579364527`, Full
System Simulation `38579364562` — all success.

**Open findings unchanged: 3 of 15** — A-07 (HIGH, requires human Stage-20 acceptance), A-13,
A-15 (MEDIUM). Canonical matrix unchanged: 48 features = 27 FOUNDATION, 3 PARTIAL,
17 IMPLEMENTED_RUNTIME_PENDING, 1 RUNTIME_VERIFIED; `productReady=false`, `currentPhase=P5`,
`humanStage20=PENDING`. Local: `test:dependency-free` **1861/1861** (+2), lint,
`workflow:validate` (52), `audit:full:repo` (7) — all PASS.

## 2026-10-15 — A-13 + A-15 CLOSED — the last two findings that code can close

**A-13 (MEDIUM) → `RUNTIME_VERIFIED`, commit `c938056`.** The launchers it described were
removed before intake, so `PARTIAL` was a status lagging the evidence — the A-14 class of defect.
Measured 2026-10-14: zero tracked `.bat`/`.cmd`/`.ps1`/`.vbs`, zero of 123 `package.json` scripts
invoking a Windows shell. `tests/ubuntu-workflow-windows-launchers.test.mjs` fails if a tracked
file has a launcher extension or a script targets a Windows shell. Measured zero, so the rule
reproduces the repository instead of demanding an escape hatch. Closed by
`T360-20261015-045528`.

**A-15 (MEDIUM) → `RUNTIME_VERIFIED`, commit `ef47455`.** Closed by `T360-20261015-131743`.

A-15 says the UI audit proves handler presence, not workflow completeness. It was demonstrated
by `R2HrConfiguration`, defined but never rendered, so `/people/attendance` and
`/people/compliance` both displayed the payroll lifecycle and all ten panels were unreachable
from every role while every gate stayed green. Presence in source is not a mounted workflow.

The gap was still live at intake. `config/admin-contextual-workflow-map.json` claimed
`inventory-control/overview` was rendered by a component called `InventoryLedger`, and that
identifier appears in **no file in the repository**. The work shipped under `OperationsView` plus
an inline ledger section, and no gate noticed that the map named a component that was never
written. Same shape as `R2HrConfiguration`, found by the same method — which is the argument for
deriving the rule rather than writing a list of known-good names.

`scripts/lib/admin-contextual-mount.mjs` derives two checks from the map and the page. A renderer
must appear as a JSX element in the page; a subview must be bound as a mode by a callsite that
mounts it. Both are wired into `audit-admin-contextual-workflows.mjs`, and either one failing
fails the audit. Three shapes are honoured rather than assumed away: a mode-less renderer such as
`ManufacturingView` is self-routing and is not asked for a mode union, a dynamic mode such as
`activeDomainView?.key` is treated as reachable, and `commerceSection` folds into
`commerce/<section>`. The subview union is recomputed per row rather than cached per component,
because a cache would make the verdict depend on row order, and a gate whose verdict depends on
iteration order is not a gate.

The wiring is proven end to end rather than by reading it: a control copies the files the audit
reads into a scratch directory, plants the same phantom renderer, and runs the real audit against
it, asserting a non-zero exit naming `InventoryLedger`. That is the A-02 standard applied to A-15's
own fix.

**Findings: 14 of 15 `RUNTIME_VERIFIED`.** The one remaining is `audit:A-07` (HIGH,
`IMPLEMENTED_RUNTIME_PENDING`): R7/F12 visual acceptance failed despite automated green. It is the
human gate and cannot be closed by code. `productReady=false`, `currentPhase=P5`,
`humanStage20=PENDING` — all unchanged. Local: `test:dependency-free` **1875/1875**, lint,
`workflow:validate`, `validate:repo`, `audit:full:repo` — all PASS.

## 2026-10-15 — A-16 CLOSED — the A-14 phrasing list was defeated by its own predicted case

A-14 closed with `tests/status-doc-currency.test.mjs`, whose rule is a curated `LIVE_CLAIM`
regex of seven phrasings. Its closing notes recorded the limitation in plain words: *"Extend the
list only when a new undated claim is measured."* The limitation was measured the next day, by
this project's own work.

Two governance documents came to assert a feature-matrix distribution whose
`IMPLEMENTED_RUNTIME_PENDING` and `RUNTIME_VERIFIED` counts were each off by one from the
authoritative figures in `config/product-completeness.json`: two blocks in `docs/PROJECT-STATE.md`
and three in `handoff/CURRENT-WORK.md`, ten count tokens in total. `git show`
across the five commits of the A-13/A-15 session confirms the matrix never held those values — the
counts were wrong when written and then copied forward between handoff blocks. The prose used none
of the seven curated phrasings, so the guard read every line as clean: local gates and all three
GitHub workflows stayed green through the whole session.

This is the same argument that raised A-15, applied to A-14's own control. A rule that is a list
of known-good names fails on the first name nobody thought of.

**The rule is now derived rather than curated.** A distribution claim is any sentence naming two
or more canonical status tokens; inside such a sentence, every `N STATUS` must equal the count in
the matrix, from `features` or from `postAuditFindings`. Both tokens and counts are read from
`config/product-completeness.json`, so there is nothing to curate and a future status token is
picked up by reading the file rather than by editing a regex.

A bare `N STATUS` is deliberately not checked, for two reasons measured on the pre-fix corpus. A
sequence such as `27 FOUNDATION, 3 PARTIAL` would otherwise read `3` as FOUNDATION's count, and
phase designators such as `` `P2 RUNTIME_VERIFIED` `` and `` `P5 IMPLEMENTED_RUNTIME_PENDING` ``
carry no count at all — a phase id is never a count, so both are exempted structurally rather
than by a list of exceptions. The naive form produced **10 hits**, one of which was a phase
designator. The sentence-scoped form produced **9 hits with none**, and all nine were this
defect. The rule was run against the documents *before* they were corrected, so it is proven red
on the real defect rather than on a synthetic case. `handoff/generated/` is excluded from the scan
because it is derived from the same source each run and cannot drift on its own.

Closed by `T360-20261015-150000`. Local: `test:dependency-free` **1878/1878** (+3), lint,
`workflow:validate` (55), `validate:repo` (1228 files / 202 Prisma models), `audit:full:repo` (7)
— all PASS.

**Findings: 15 of 16 `RUNTIME_VERIFIED`.** The one remaining is `audit:A-07` (HIGH) — the human
gate, which code cannot close. `productReady=false`, `currentPhase=P5`, `humanStage20=PENDING` —
all unchanged.

## 2026-10-15 — A-17 CLOSED — controller granularity hid 34 unreachable endpoints, all behind a reachable sibling

`config/f1-backend-ui-audit.json` answers one question per controller: is *any* route of this
controller called by a UI app? It sets `routeStrings.some(...)` against the UI's callsites with a raw
`.includes()`, and writes one label plus a `uiApps` list. Today that reports **45 of 46 controllers
as `EXPOSED_OR_PARTIAL`** and only `edge-sync.controller.ts` as `HIDDEN_OR_API_ONLY`.

The verdict is not false. It is too coarse to be a gate. A controller with one dead endpoint and
thirty live ones is indistinguishable from a controller that is fully wired, and nothing between
intake and release could name the difference — which is the defect, stated as precisely as the
evidence allows.

Measured at endpoint granularity on this tree:

| | |
| --- | --- |
| Controllers | **46** — 36 `ALL_REACHED`, 9 `MIXED`, 1 `NONE_REACHED` |
| Routes | **532** across **428** distinct paths |
| Reachable | **495** |
| Flagged (unreachable, with a reachable sibling) | **34** |

`scripts/audit-full-repository.mjs` runs first in the same chain and independently reports **532 API
handlers**; two counts derived by different code from the same tree agree. The 3 routes that are
unreachable but *not* flagged are `edge-sync`'s three — no sibling there is reached, so an API-only
surface contributes nothing by design.

The 34 split **22 `NODE_PROTOCOL`, 8 `UI_GAP`, 2 `SUPERSEDED`, 1 `DEVICE_INGEST`,
1 `PROVIDER_CALLBACK`**. The 8 gaps are `branch-transfer` detail and departure, digital-services
transaction detail, bulk `offline-transactions`, `platform/automation-jobs/:id`, and the
`scan`/`submit`/`discard` steps of the mobile opname draft. In every one the surrounding workflow is
open and in use — settle and refund work, the opname draft opens and renders its discrepancy — while
one step of it is unreachable. That is precisely the shape a controller-granularity verdict cannot
see, and it is the reason `UI_GAP` entries are recorded as open work rather than as exceptions.

**Two extractor defects would each have invalidated the finding on their own**, and both are pinned
as regression cases:

- A bare interpolation token was allowed to match as **prefix and suffix**. The single line
  ``return `${workspace.route}/${view.key}`;`` at `apps/admin/app/domain-workspaces.ts:122` yields
  exactly one token, `/:p`, and under two-way leniency that one token covered **11 unrelated
  endpoints** across `branch-continuity`, `edge-sync` and `platform`. Fixed: a `:p` token segment
  covers a `:p` route segment and nothing else.
- A path assembled from a ternary on one line was not read. `hr-payroll.tsx` builds the approver
  path from `${kind==='tax'?'/payroll/tax-rule-sets':'/payroll/social-security-rule-sets'}`, and
  exact matching reported **both** approvers unreachable while a user was clicking them. Fixed:
  coverage is per line over a contiguous run of segments, so the literal half becomes its own token.

Four more were removed before the number could be trusted: a quote-pairing regex that drifted parity
and missed every `/auth/2fa/*` call, a missing `api<T>(...)` type-parameter group that hid **68**
call sites, a `^\/(assets|_next|...)` filter colliding with the `/assets` **API namespace**, and
`collectRoutes` returning declarations without verdicts — which printed **0 reachable routes beside
36 fully-reached controllers**.

The gate is a human-edited ledger, `config/frontend-endpoint-coverage-baseline.json`, and it fails in
**both** directions: a new dead sibling and a stale entry are both non-zero exits, as is a reason
shorter than 40 characters, because an exception with no stated basis is not a review. The
anti-silencing rule is derived rather than listed — an endpoint behind `@Roles` is human-facing by
construction and may only ever be `UI_GAP`, read from the decorator, so relabeling a missing screen
as node protocol fails the gate instead of clearing it. Three of the 8 gaps are `@Roles`-guarded, so
that shortcut is closed.

Scope follows the in-repo clients. `apps/customer-mobile` was assumed to be an empty scaffold and is
not: it is a Flutter application whose three Dart files call `/platform/manifest` and
`/api/v1/products`, so `.dart` is scanned and those two paths are covered. `apps/worker` reaches the
Telegram and Digiflazz providers and nothing else, which is what makes `NODE_PROTOCOL` a measurement
rather than a guess.

`npm run audit:endpoint:coverage` is chained into `npm run audit:full:repo`, so both heavy GitHub
workflows execute it. Local: `test:dependency-free` **1886/1886** (+8), lint, `workflow:validate`
(56), `validate:repo` (1234 files / 202 Prisma models), `audit:full:repo` — all PASS.

Closed by `T360-20261015-164416`. CI on `44231ed`: Workflow Governance `38712544190` (28s), Full
System Simulation `38712544100` (7m59s), Full Automated UAT `38712544099` (7m43s) — all success. The
simulation job log records the gate executing rather than merely being scheduled:
`audit:endpoint:coverage` reporting `controllers 46 (36 ALL_REACHED, 9 MIXED, 1 NONE_REACHED)`,
`routes 532 across 428 distinct paths`, `flagged endpoints …: 34`, `baseline agreed: 34`, beside
`Product completeness audit PASS … 17 post-audit findings` and `# tests 1886 / # pass 1886 / # fail 0`.

`productReady=false`, `currentPhase=P5`, `humanStage20=PENDING` — unchanged. **Findings: 16 of 17
`RUNTIME_VERIFIED`.** The one remaining is `audit:A-07` (HIGH), the human visual gate. A-17 closes the
guard, not the gaps: the 8 `UI_GAP` entries remain open work on separate screens.
