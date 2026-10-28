# Sesi Kerja Opening Balance - 2026-10-24

## Status Awal

Dari handoff lanjutan 17 (2026-10-22):
- ✅ Posting GL opening balance SELESAI
- ✅ Reversal GL SELESAI  
- ✅ Posting AR/AP dengan OpeningLedgerDocument SELESAI
- ✅ Posting STOCK terintegrasi costing SELESAI
- ✅ Reversal STOCK SELESAI

## Pekerjaan Sesi Ini

### 1. Reversal AR/AP ⏳
**File:** `apps/api/src/opening-balance/opening-balance.service.ts`

**Gap saat ini:** Method `reverseGl()` (line 1177) hanya handle reversal STOCK. Perlu tambah:
- Set `OpeningLedgerDocument.status` ke `WRITTEN_OFF` atau `CANCELLED`
- Validasi tidak ada settlement yang sudah diproses
- Cleanup outstanding amount

**Implementasi:**
```typescript
// Di dalam reverseGl, setelah accounting.postReversal
if (current.type === OpeningBalanceType.AR || current.type === OpeningBalanceType.AP) {
  const documents = await tx.openingLedgerDocument.findMany({
    where: { companyId: scope.companyId, branchId: scope.branchId, rowId: { in: current.rows.map(r => r.id) } }
  });
  
  // Validasi tidak ada settlement
  const settled = documents.filter(doc => doc.settledAmount.greaterThan(0));
  if (settled.length) {
    throw new ConflictException({ 
      code: 'OPENING_LEDGER_SETTLEMENT_EXISTS',
      message: `Dokumen ${settled.map(d => d.documentNumber).join(', ')} sudah memiliki settlement dan tidak dapat dibalik.`
    });
  }
  
  // Set status WRITTEN_OFF
  await tx.openingLedgerDocument.updateMany({
    where: { id: { in: documents.map(d => d.id) } },
    data: { status: OpeningLedgerStatus.WRITTEN_OFF, outstandingAmount: new Prisma.Decimal(0) }
  });
}
```

### 2. Settlement Opening Ledger ⏳
**File baru:** Perlu tambah method di `opening-balance.service.ts`

**Kontrak ADR:**
- Settlement via `OperationalFinanceTransaction` dengan `referenceType = 'OpeningLedgerDocument'`
- Perbarui `settledAmount` dan `outstandingAmount` atomik
- Tidak membuat `TaxTransaction` baru
- Unique constraint `(documentId, financeTransactionId)`

**Implementasi:**
```typescript
async settleDocument(
  user: AuthUser,
  documentId: string,
  dto: { financeTransactionId: string; amount: Prisma.Decimal; settledAt?: Date }
) {
  const scope = this.requireTenantScope(user);
  // Validasi document, transaction, amount <= outstanding
  // Update OpeningLedgerDocument settledAmount, outstandingAmount
  // Update status jika fully settled
  // Create OpeningLedgerSettlement
  // Audit log
}
```

**Controller endpoint:**
- `POST /accounting/opening-balance/documents/:id/settle`
- Permission: `accounting.opening.post` (reuse existing)

### 3. Cutover Gate ⏳
**File baru:** Function validation di service

**Kontrak ADR (section 7):**
- Semua batch STOCK/AR/AP/GL POSTED
- Trial balance debit=kredit
- AR/AP subledger = control account
- Inventory = cost layer = inventory control
- Tidak ada row FAILED/POSTING/WAITING_APPROVAL

**Implementasi:**
```typescript
async validateCutoverGate(user: AuthUser, cutoverDate: Date): Promise<CutoverGateResult> {
  const scope = this.requireTenantScope(user);
  const batches = await this.prisma.openingBalanceBatch.findMany({
    where: { companyId: scope.companyId, branchId: scope.branchId, cutoverDate }
  });
  
  const gates = {
    allBatchesPosted: batches.every(b => b.status === 'POSTED'),
    trialBalanceBalanced: await this.checkTrialBalance(scope, cutoverDate),
    subledgerTieOut: await this.checkSubledgerTieOut(scope, cutoverDate),
    inventoryTieOut: await this.checkInventoryTieOut(scope, cutoverDate),
    noFailedRows: !batches.some(b => b.errorRowCount > 0),
  };
  
  return { passed: Object.values(gates).every(Boolean), gates, blockers: [] };
}
```

**Controller endpoint:**
- `GET /accounting/opening-balance/cutover-gate?cutoverDate=...`
- Permission: `accounting.opening.view`

### 4. Year-End Close Foundation ⏳
**File:** Perlu buat module/service baru `year-end-close.service.ts`

**Kontrak ADR (section 8):**
1. Preview: hitung revenue/expense -> incomeSummary -> retainedEarnings
2. Validasi: trial balance, no pending events, subledger tie-out
3. Approval: maker-checker
4. Auto-post: `postSystemJournal` dengan key `year-end-close:<company>:<branch>:<year>:v1`
5. Period lock: soft close -> final close
6. Reversal: bila SOFT_CLOSED, reopen + reversal

**Fase implementasi:**
- **Fase 1 (sesi ini):** Model sudah ada, buat service foundation + preview
- **Fase 2 (next):** Approval flow + auto-post
- **Fase 3 (next):** Period lock integration + reversal

**Implementasi Fase 1:**
```typescript
@Injectable()
export class YearEndCloseService {
  async preview(user: AuthUser, dto: { fiscalYear: number }) {
    // Query AccountingPosting untuk fiscal year
    // Aggregate revenue (type=REVENUE) dan expense (type=EXPENSE)
    // Generate closing lines: revenue -> incomeSummary, expense -> incomeSummary, net -> retained
    // Save YearEndCloseRun dengan status DRAFT
    // Return preview
  }
}
```

### 5. Test HTTP Permission Guard ⏳
**File:** `tests/opening-balance-role-guard.test.mjs`

**Coverage:**
- Setiap endpoint controller harus diuji dengan:
  - ✅ FINANCE/OWNER -> 200/201
  - ✅ AUDITOR -> 200 untuk read, 403 untuk write
  - ✅ WAREHOUSE -> 403 semua
  - ✅ Unauthorized -> 401

**Endpoint yang harus diuji:**
- GET /opening-balances (list)
- GET /opening-balances/:id (detail)
- GET /opening-balances/:id/rows (rows)
- POST /opening-balances (create)
- POST /opening-balances/:id/revalidate
- POST /opening-balances/:id/submit
- POST /opening-balances/:id/approve
- POST /opening-balances/:id/post
- POST /opening-balances/:id/reverse
- POST /opening-balances/:id/cancel
- POST /opening-balance/documents/:id/settle (new)
- GET /opening-balance/cutover-gate (new)

### 6. Test Concurrency ⏳
**File:** `tests/w3-opening-balance-concurrency.test.mjs`

**Skenario:**
- Dua approver approve batch yang sama -> salah satu ditolak CAS
- Dua poster post batch yang sama -> idempotent, hanya satu event
- Approve + cancel bersamaan -> CAS mencegah race
- Posting + reversal bersamaan -> serializable isolation mencegah

### 7. PostgreSQL Rehearsal ⏳
**Dependency:** Butuh `T360_MIGRATION_DATABASE_URL`

**Checklist:**
- Migration expand-only teraplikasi
- Baseline PostgreSQL sinkron (sudah done lanjutan 14)
- Partial unique index `YearEndCloseRun_posted_scope_key` ada
- Schema parity 3 dialek
- Seed permission/flag tersedia

## Urutan Eksekusi

1. ✅ Buat dokumen kerja ini
2. ⏳ Implementasi reversal AR/AP (minor patch)
3. ⏳ Implementasi settlement opening ledger (service + controller + DTO)
4. ⏳ Implementasi cutover gate validation
5. ⏳ Implementasi year-end close preview (foundation)
6. ⏳ Test HTTP permission guard
7. ⏳ Test concurrency
8. ⏳ Quality gate: `npm run quality:recorded:fast`
9. ⏳ Update handoff dengan bukti

## Kriteria Selesai

- [ ] Reversal AR/AP handle document status
- [ ] Settlement endpoint tersedia dan teruji
- [ ] Cutover gate validation tersedia
- [ ] Year-end close preview tersedia
- [ ] Test HTTP guard 15+ endpoint pass
- [ ] Test concurrency 4 skenario pass
- [ ] `quality:recorded:fast` PASS 2061+/2061+
- [ ] Handoff CURRENT-WORK.md updated dengan lanjutan 18

## Known Limitations (dari ADR)

- Payroll adjustment bypass masih ada (blocker production-ready)
- Multi-currency, konsolidasi out of scope
- Sync lintas node belum tersedia
- PostgreSQL rehearsal butuh env khusus

## Evidence yang Akan Dihasilkan

1. Patch `opening-balance.service.ts` dengan reversal AR/AP
2. File baru `year-end-close.service.ts` + controller + DTO
3. Test file `opening-balance-role-guard.test.mjs`
4. Test file `w3-opening-balance-concurrency.test.mjs`
5. Log quality gate terbaru
6. Entry handoff lanjutan 18

---

**Mulai:** 2026-10-24T13:48:00Z
**Target selesai:** Semua implementasi + test pass dalam sesi ini
**Commit:** Ditahan sampai perintah user (sesuai aturan repo)
