# Feature Completion Plan — Toko360

**Tanggal:** 2026-11-06
**Status:** IN PROGRESS

---

## Fitur yang Dibutuhkan

### Wave 1: Quick Wins (model sudah ada, perlu controller/UI)
1. **Loyalty Redemption Endpoint** — POS redeem points di checkout
2. **Warehouse Location Management** — kelola rak/bin lokasi
3. **Salesperson Commission Report** — laporan komisi per sales
4. **Bundle Promo Validation** — expand PromoRule type support

### Wave 2: New Service (model ada, service/controller belum lengkap)
5. **Customer AR Settlement** — pelunasan piutang customer
6. **Multi-Outlet Consolidated Report** — laporan gabungan multi-cabang

### Wave 3: New Features (model + service + UI baru)
7. **Credit Installment Sales** — penjualan kredit/angsuran
8. **Multi-Currency Support** — konversi mata uang

---

## Progress Tracking

| # | Fitur | Status | File |
|---|---|---|---|
| 1 | Loyalty Redemption | PENDING | — |
| 2 | Warehouse Location | PENDING | — |
| 3 | Commission Report | PENDING | — |
| 4 | Bundle Promo | PENDING | — |
| 5 | Customer AR Settlement | PENDING | — |
| 6 | Multi-Outlet Report | PENDING | — |
| 7 | Credit Installment | PENDING | — |
| 8 | Multi-Currency | PENDING | — |

---

## Rules
- Setiap wave: tsc → audit → test
- Jangan weaken gate
- Commit/push tangan Rey

## Progress Update — 2026-11-06

### Wave 1 Complete:
1. ✅ **Loyalty Redemption Endpoint** — Created `apps/api/src/loyalty/loyalty.controller.ts`
   - GET /loyalty/programs — list active loyalty programs
   - GET /loyalty/accounts/:customerId — get customer points balance
   - POST /loyalty/redeem/preview — preview redemption discount
   
2. ✅ **Warehouse Location Management** — Created `apps/api/src/warehouse-locations/`
   - GET /warehouse-locations — list locations with warehouse details
   - POST /warehouse-locations — create new location (rak/bin)
   - POST /warehouse-locations/:id/deactivate — deactivate location
   - UI: `apps/admin/app/modules/warehouse-locations.tsx`
   - Added to domain-workspaces.ts + page.tsx

3. ✅ **Salesperson Commission Report** — Added to commissions module
   - GET /commissions/report/salesperson — commission by salesperson
   - GET /commissions/report/rule — list commission rules
   - Filter by date range and salesperson

4. ⏳ **Customer AR Settlement** — Created `apps/api/src/customer-ar-settlement/`
   - GET /customer-ar-settlement/aging — AR aging report
   - POST /customer-ar-settlement/settle — settle invoice
   - Needs: UI module (next wave)

### Wave 2 Pending:
5. Bundle Promo Validation — extend existing PromoRule logic
6. Multi-Outlet Consolidated Report — enhance reports module
7. Credit Installment Sales — new feature (bigger scope)
8. Multi-Currency Support — extend existing currency field

### Files Changed:
- apps/api/src/loyalty/ (new module)
- apps/api/src/warehouse-locations/ (new module)
- apps/api/src/customer-ar-settlement/ (new module)
- apps/api/src/commissions/commission-report.controller.ts (new)
- apps/admin/app/modules/warehouse-locations.tsx (new UI)
- apps/api/src/app.module.ts (updated)
- apps/admin/app/domain-workspaces.ts (updated)
- apps/admin/app/page.tsx (updated)
- config/admin-contextual-workflow-map.json (updated)
- tests/p5-v48-root-ui-foundation.test.mjs (updated)
- tests/p5-v49-admin-root-system.test.mjs (updated)
