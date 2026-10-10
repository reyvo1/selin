# Implementation Checklist — T360-20260925-143000

## Analysis

- [ ] Baca work item dan seluruh dokumen sumber.
- [ ] Audit implementasi yang sudah ada; jangan membuat modul duplikat.
- [ ] Tetapkan system of record, state machine, invariant, dan failure modes.
- [ ] Konfirmasi dampak database, inventory, accounting, tax, payment, payroll, sync, security, dan performance.

## Design

- [ ] Tetapkan API/DTO/event contract.
- [ ] Tetapkan permission dan tenant/branch scope.
- [ ] Tetapkan idempotency key serta retry behavior.
- [ ] Tetapkan migration, index, pagination, retention, dan rollback.
- [ ] Tetapkan accounting/tax posting rule bila relevan.

## Implementation

- [ ] Implementasi kecil dan modular.
- [ ] Hindari jurnal, pajak, stok, atau notification logic tersebar di modul.
- [ ] Tambahkan audit event dan structured error.
- [ ] Perbarui dokumentasi dan feature flag.

## Verification

- [ ] npm run prisma:generate:postgres -w @toko360/api
- [ ] npm run lint -w @toko360/api
- [ ] npm run lint -w @toko360/admin
- [ ] node --test tests/recovery-r8-runtime-uat.test.mjs
- [ ] npm run workflow:validate
- [ ] npm run validate:repo
- [ ] npm run audit:recovery
- [ ] npm run audit:full:repo
- [ ] npm run ci:ui:audit
- [ ] npm run test:dependency-free
- [ ] GitHub exact-source PostgreSQL workflows: R7 PASS, R8 reporting/security PASS, Browser safe mutations PASS, R8 final probe PASS
- [ ] Jalankan `npm run quality:fast`.
- [ ] Jalankan `npm run quality:full` sebelum release.
- [ ] Catat evidence dan known issues pada work item/handoff.

## Release

- [ ] UAT atau staging selesai.
- [ ] Rollback plan telah diuji atau direview.
- [ ] Monitoring aktif.
- [ ] Work item dipindahkan ke RELEASE_READY, RELEASED, lalu CLOSED sesuai evidence.
