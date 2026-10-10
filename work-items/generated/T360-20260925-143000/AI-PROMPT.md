# Prompt Pelaksana — T360-20260925-143000

Kerjakan work item Toko360 berikut pada repository ini. Jangan membangun ulang modul yang sudah ada dan jangan mengubah alur stabil tanpa bukti.

## Identitas
- ID: T360-20260925-143000
- Judul: R8 GitHub full runtime UAT and release evidence
- Modul: release-uat
- Wave: W7
- Risk: HIGH
- Work item file: work-items/active/T360-20260925-143000-recovery-r8-runtime-uat.json

## Instruksi wajib
1. Baca docs/DEVELOPMENT-KIT.md, docs/DEVELOPMENT-WORKFLOW.md, work item, dan dokumen sumbernya.
2. Audit source yang ada sebelum mengedit.
3. Kerjakan hanya scope work item dan pertahankan kompatibilitas.
4. Semua data harus company/branch scoped.
5. Semua mutasi yang dapat diulang harus idempotent.
6. Stok hanya berubah melalui inventory movement; jurnal melalui accounting core; pajak melalui tax core.
7. Tambahkan permission, audit, validation, pagination/index bila relevan.
8. Tambahkan test sesuai test plan dan jalankan quality gate.
9. Perbarui work item dengan evidence, perubahan, known issues, dan rollback.
10. Jangan memakai database production, credential, atau data pelanggan nyata.

## Acceptance criteria
- ci:uat:coverage is explicitly classified SOURCE_CONTRACT and not runtime closure evidence.
- ci:r8:reporting-security-probe passes F23/F24/F25/F44 on PostgreSQL runtime.
- Built Browser UAT emits R8_SAFE_MUTATION_JOURNEYS with owner-reporting and HR mutation evidence and productionTouched=false.
- ci:r8:probe emits 12/12 executed critical scenarios bound to current source and exact build artifact.
- Both PostgreSQL GitHub workflows execute R8 reporting/security and final R8 release probes without continue-on-success bypass in their aggregate enforcement.
- Full-system summary and GitHub UAT report surface both R8 gates.
- Human Stage-20 remains PENDING after automated R8 PASS.

## Test plan
- npm run prisma:generate:postgres -w @toko360/api
- npm run lint -w @toko360/api
- npm run lint -w @toko360/admin
- node --test tests/recovery-r8-runtime-uat.test.mjs
- npm run workflow:validate
- npm run validate:repo
- npm run audit:recovery
- npm run audit:full:repo
- npm run ci:ui:audit
- npm run test:dependency-free
- GitHub exact-source PostgreSQL workflows: R7 PASS, R8 reporting/security PASS, Browser safe mutations PASS, R8 final probe PASS

Berikan hasil berupa perubahan source code, migration aman bila diperlukan, test, dokumentasi, dan ringkasan evidence.
