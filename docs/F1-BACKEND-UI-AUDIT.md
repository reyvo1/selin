# F1 — Backend Capability vs UI Exposure Audit

Generated: 2026-11-07T14:08:28.246Z

## Repository scan

- Prisma models: 234
- API controllers: 71
- API routes: 683
- UI apps: admin, pos, storefront, employee-portal

## Classification summary

- EXPOSED: 9
- PARTIAL: 1
- HIDDEN: 0
- MISSING: 0
- UNKNOWN: 0

## F2–F11 capability matrix

| Phase | Capability | Status | Backend routes | UI apps | Gap |
|---|---|---:|---:|---|---|
| F2 | Master Product + Multi-UOM | **EXPOSED** | 23 | admin, pos, storefront | Multi-UOM berbasis barcode/factor sudah ada, tetapi ProductVariant dan model konversi UOM first-class belum terlihat sebagai model dedicated. F2 harus menormalkan master produk/variant/UOM tanpa merusak POS yang sudah memakai quantityFactor. |
| F3 | Inventory / batch / expiry / condition | **EXPOSED** | 38 | admin, pos | Batch, serial, location, transfer, opname sudah kuat. Condition bucket general seperti AVAILABLE/DAMAGED/QUARANTINE/LOST belum terlihat sebagai inventory condition ledger first-class. |
| F4 | Accounting workspace enterprise | **EXPOSED** | 20 | admin | Accounting core kuat dan UI ledger sudah ada, tetapi posting rule/account mapping/version management serta source→event→journal→line drill-down belum terbukti lengkap di operator UI. |
| F5 | Tax workspace dinamis | **EXPOSED** | 10 | admin | Tax engine/model tersedia, tetapi tax transaction/document ledger, effective-dated rule management, preview, reconciliation, dan audit trail belum seluruhnya terekspos di UI. |
| F6 | Financial reporting + drill-down | **EXPOSED** | 33 | admin | ReportJob dan katalog report tersedia. F6 harus menambah dynamic filters, period comparison, branch/cost-center dimensions, dan report→account→journal→source drill-down. |
| F7 | AR / AP / Cash / Bank / Reconciliation | **EXPOSED** | 26 | admin | Operational AP/AR dan bank reconciliation sudah ada. Aging, statement/detail navigation, settlement trace, dan reconciliation operator flow perlu diperdalam. |
| F8 | Automation + scheduled reports | **EXPOSED** | 37 | admin, pos, storefront, employee-portal | Automation worker tersedia, tetapi scheduler/report schedule first-class dan operator execution history/rule management belum lengkap. |
| F9 | WhatsApp / Telegram notification center | **PARTIAL** | 8 | admin, employee-portal | Template, queue, Telegram worker, WhatsApp provider adapter, dan UI queue sudah ada. Provider setup/verification, channel binding UX, scheduled report destinations, retry diagnostics, dan production readiness masih harus dituntaskan. |
| F10 | AI / forecasting / operator assistant | **EXPOSED** | 8 | admin | Source implementation lengkap: explainable forecast/reorder, permission-scoped deterministic operator assistant, anomaly insights, confidence, source links, dan human-confirmation guardrail tersedia. Runtime/browser/human UAT tetap wajib sebelum closure. |
| F11 | Purchase / Sales / POS integration ke UOM baru | **EXPOSED** | 43 | admin, pos, storefront | Purchase-side UOM sudah first-class pada PurchaseRequest, PurchaseOrder dan GoodsReceipt: satu resolver bersama (common/purchase-uom.ts) memvalidasi ProductUnit/barcode terhadap master UNIT perusahaan, menyimpan snapshot unitCode/quantityFactor/unitQuantity pada tiap dokumen, dan menjaga stok, pajak serta jurnal tetap memakai base quantity dan harga base. Sisa gap F11 bukan lagi konversi, melainkan bukti runtime dan closure Human Stage-20: hanya sisi jual (POS) yang punya runtime test purchase-independent, dan tests/f11-purchase-uom-request-barcode-scan-runtime.test.mjs harus tetap hijau pada setiap perubahan konversi. |

## Controller exposure inventory

| Controller | Routes | UI exposure | Apps |
|---|---:|---|---|
| `apps/api/src/accounting-core/accounting-core.controller.ts` | 20 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/advanced-inventory/advanced-inventory.controller.ts` | 16 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/app.controller.ts` | 1 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/assets/assets.controller.ts` | 15 | EXPOSED_OR_PARTIAL | admin, pos, storefront, employee-portal |
| `apps/api/src/attendance/attendance.controller.ts` | 25 | EXPOSED_OR_PARTIAL | admin, employee-portal |
| `apps/api/src/auth/api-keys.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/auth/auth.controller.ts` | 15 | EXPOSED_OR_PARTIAL | admin, pos, employee-portal |
| `apps/api/src/branch-continuity/branch-continuity.controller.ts` | 21 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/branch-continuity/branch-transfer.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/branch-sync/branch-sync.controller.ts` | 20 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/cash-flow-categories/cash-flow-categories.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/cheques/cheques.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/commissions/commission-report.controller.ts` | 2 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/commissions/commissions.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/consignments/consignments.controller.ts` | 7 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/customer-ar-settlement/customer-ar-settlement.controller.ts` | 2 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/customer-deposits/customer-deposits.controller.ts` | 6 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/customer-groups/customer-groups.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/customer-regions/customer-regions.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/digital-services/digital-services.controller.ts` | 9 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/employee-self-service/employee-self-service.controller.ts` | 16 | EXPOSED_OR_PARTIAL | employee-portal |
| `apps/api/src/extensions/edge-sync.controller.ts` | 3 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/extensions/extensions.controller.ts` | 58 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/finance-operations/finance-operations.controller.ts` | 13 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/fleet/fleet.controller.ts` | 14 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/general/general-settings.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/general-settings/general-settings.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/goods-receipts/goods-receipts.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/hr/hr.controller.ts` | 17 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/inventory/costing.controller.ts` | 14 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/inventory/cross-branch-stock.controller.ts` | 1 | EXPOSED_OR_PARTIAL | pos |
| `apps/api/src/inventory/inventory.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/kiosk/kiosk.controller.ts` | 1 | EXPOSED_OR_PARTIAL | pos |
| `apps/api/src/loyalty/loyalty.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/manufacturing/manufacturing.controller.ts` | 13 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/master-data/master-data.controller.ts` | 36 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/migration/migration.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/mobile-ops/mobile-ops.controller.ts` | 10 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/number-sequences/number-sequences.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/opening-balance/opening-balance.controller.ts` | 16 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/operations-control/operations-control.controller.ts` | 13 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/orders/orders.controller.ts` | 11 | EXPOSED_OR_PARTIAL | admin, pos, storefront, employee-portal |
| `apps/api/src/payments/payments.controller.ts` | 2 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/payroll/payroll.controller.ts` | 30 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/platform/platform.controller.ts` | 45 | EXPOSED_OR_PARTIAL | admin, pos, storefront, employee-portal |
| `apps/api/src/printers/print-jobs.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/printers/printers.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/products/products.controller.ts` | 8 | EXPOSED_OR_PARTIAL | admin, pos, storefront, employee-portal |
| `apps/api/src/promotions/promotions.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/purchase-orders/purchase-orders.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/purchase-orders/purchase-requests.controller.ts` | 7 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/reports/daily-digest.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/reports/multi-outlet.controller.ts` | 1 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/reports/reports.controller.ts` | 28 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/returns/returns.controller.ts` | 10 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/returns/storefront-order-returns.controller.ts` | 2 | EXPOSED_OR_PARTIAL | storefront |
| `apps/api/src/sales/cashier-target.controller.ts` | 2 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/sales/receipt.controller.ts` | 1 | EXPOSED_OR_PARTIAL | pos |
| `apps/api/src/sales/sales.controller.ts` | 11 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/sales-orders/sales-orders.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/settings/general-settings.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/staff-memos/staff-memos.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin, pos, employee-portal |
| `apps/api/src/storefront-customer/storefront-customer.controller.ts` | 19 | EXPOSED_OR_PARTIAL | storefront |
| `apps/api/src/supervisor-approval/supervisor-approval.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/supplier-deposits/supplier-deposits.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/supplier-prices/supplier-prices.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/suppliers/suppliers.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/trade-ins/trade-ins.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/transfer-files/transfer-files.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/users/users.controller.ts` | 8 | EXPOSED_OR_PARTIAL | admin, pos, storefront, employee-portal |
| `apps/api/src/warehouse-locations/warehouse-locations.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |

## Locked implementation order

F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11 → F12

F1 audit tidak mengubah business logic. Output ini menjadi source backlog functional completion berikutnya.
