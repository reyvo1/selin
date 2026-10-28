'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table, StatusChip, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Batch = {
  id: string;
  type: string;
  cutoverDate: string;
  status: string;
  sourceFileName: string | null;
  totalDebit: string;
  totalCredit: string;
  rowCount: number;
  validRowCount: number;
  errorRowCount: number;
  createdBy: string | null;
  approvedBy: string | null;
  postedAt: string | null;
  createdAt: string;
};

type BatchRow = {
  id: string;
  rowNumber: number;
  status: string;
  productId?: string | null;
  warehouseId?: string | null;
  accountCode?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  documentNumber?: string | null;
  quantity?: number | null;
  debit?: number | string | null;
  credit?: number | string | null;
  total?: number | string | null;
  errorMessage?: string | null;
};

type CutoverStatus = {
  ready: boolean;
  checks: Record<string, boolean>;
  totals: { debit: string; credit: string; arOutstanding: string; apOutstanding: string };
  batchCount: number;
};

type YearEndRun = {
  id: string;
  fiscalYear: number;
  status: string;
  netIncome?: string | number | null;
  totalDebit?: string | number | null;
  totalCredit?: string | number | null;
  journalEntryId?: string | null;
};

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`${API}${path}`, token, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.message) ? data.message.join(', ') : data.message ?? data?.error ?? 'Permintaan gagal.';
    throw new Error(detail);
  }
  return data as T;
}

export default function OpeningBalanceView({ token, mode }: { token: string; mode?: string | null }) {
  const { canAll } = usePermissions(token);
  const canView = canAll('accounting.opening.view');
  const canImport = canAll('accounting.opening.import');
  const canApprove = canAll('accounting.opening.approve');
  const canPost = canAll('accounting.opening.post');
  const canReverse = canAll('accounting.opening.reverse');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Batch | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [rowsStatus, setRowsStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState('GL');
  const [cutoverDate, setCutoverDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceFileName, setSourceFileName] = useState('');
  const [controlAccountCode, setControlAccountCode] = useState('');
  const [offsetAccountCode, setOffsetAccountCode] = useState('');
  const [suspenseAccountCode, setSuspenseAccountCode] = useState('');
  const [csv, setCsv] = useState('');
  const [rowsJson, setRowsJson] = useState('');
  const [operationKey, setOperationKey] = useState(`opening-${Date.now()}`);
  const [preview, setPreview] = useState<any>(null);

  const [revalidateReason, setRevalidateReason] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');

  const [settleDocumentId, setSettleDocumentId] = useState('');
  const [settleFinanceTransactionId, setSettleFinanceTransactionId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleOperationKey, setSettleOperationKey] = useState(`settle-${Date.now()}`);

  const [cutover, setCutover] = useState<CutoverStatus | null>(null);
  const [yearEndFiscalYear, setYearEndFiscalYear] = useState(new Date().getFullYear() - 1);
  const [retainedEarningsAccountCode, setRetainedEarningsAccountCode] = useState('');
  const [incomeSummaryAccountCode, setIncomeSummaryAccountCode] = useState('');
  const [yearEndOperationKey, setYearEndOperationKey] = useState(`year-end-${Date.now()}`);
  const [yearEndRun, setYearEndRun] = useState<YearEndRun | null>(null);
  const [reverseYearEndReason, setReverseYearEndReason] = useState('');
  const [reverseYearEndOperationKey, setReverseYearEndOperationKey] = useState('');

  async function refreshBatches() {
    if (!canView) return;
    const data = await req<{ items?: Batch[] } | Batch[]>(token, '/accounting/opening-balance/batches');
    const items = Array.isArray(data) ? data : data.items ?? [];
    setBatches(items);
  }

  async function loadDetail(id: string) {
    if (!id || !canView) return;
    const detailData = await req<Batch>(token, `/accounting/opening-balance/batches/${id}`);
    setDetail(detailData);
    const rowsPath = rowsStatus
      ? `/accounting/opening-balance/batches/${id}/rows?status=${encodeURIComponent(rowsStatus)}`
      : `/accounting/opening-balance/batches/${id}/rows`;
    const rowsData = await req<{ items?: BatchRow[] } | BatchRow[]>(token, rowsPath);
    setRows(Array.isArray(rowsData) ? rowsData : rowsData.items ?? []);
  }

  useEffect(() => {
    void refreshBatches().catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat batch'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canView]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId).catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat detail'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, rowsStatus]);

  function parsedRows(): any[] | undefined {
    const trimmed = rowsJson.trim();
    if (!trimmed) return undefined;
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  async function runPreview(dryRun: boolean) {
    if (!canImport) return;
    setBusy(true);
    setMessage('');
    try {
      const body: Record<string, unknown> = {
        type,
        cutoverDate,
        sourceFileName: sourceFileName.trim() || undefined,
        csv: csv.trim() || undefined,
        rows: parsedRows(),
        controlAccountCode: controlAccountCode.trim() || undefined,
        offsetAccountCode: offsetAccountCode.trim() || undefined,
        suspenseAccountCode: suspenseAccountCode.trim() || undefined,
        dryRun,
      };
      if (!dryRun) body.operationKey = operationKey.trim();
      const endpoint = dryRun ? '/accounting/opening-balance/batches/preview' : '/accounting/opening-balance/batches';
      const result = await req(token, endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setPreview(result);
      if (!dryRun) {
        await refreshBatches();
        setMessage('Batch saldo awal dibuat.');
      } else {
        setMessage('Preview saldo awal selesai.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memproses batch');
    } finally {
      setBusy(false);
    }
  }

  async function revalidateSelected() {
    if (!selectedId || !canImport) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await req(token, `/accounting/opening-balance/batches/${selectedId}/revalidate`, {
        method: 'POST',
        body: JSON.stringify({ reason: revalidateReason.trim() || undefined }),
      });
      setDetail(result as Batch);
      await refreshBatches();
      setMessage('Batch divalidasi ulang.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal revalidate');
    } finally {
      setBusy(false);
    }
  }

  async function submitSelected() {
    if (!selectedId || !canImport) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, `/accounting/opening-balance/batches/${selectedId}/submit`, { method: 'POST' });
      await loadDetail(selectedId);
      await refreshBatches();
      setMessage('Batch diajukan approval.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal submit');
    } finally {
      setBusy(false);
    }
  }

  async function approveSelected() {
    if (!selectedId || !canApprove) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, `/accounting/opening-balance/batches/${selectedId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: approvalNote.trim() || undefined }),
      });
      await loadDetail(selectedId);
      await refreshBatches();
      setMessage('Batch disetujui.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal approve');
    } finally {
      setBusy(false);
    }
  }

  async function cancelSelected() {
    if (!selectedId || !actionReason.trim() || !canImport) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, `/accounting/opening-balance/batches/${selectedId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      await loadDetail(selectedId);
      await refreshBatches();
      setMessage('Batch dibatalkan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal cancel');
    } finally {
      setBusy(false);
    }
  }

  async function postSelected() {
    if (!selectedId || !canPost) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, `/accounting/opening-balance/batches/${selectedId}/post`, { method: 'POST' });
      await loadDetail(selectedId);
      await refreshBatches();
      setMessage('Batch diposting.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal post');
    } finally {
      setBusy(false);
    }
  }

  async function reverseSelected() {
    if (!selectedId || !actionReason.trim() || !canReverse) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, `/accounting/opening-balance/batches/${selectedId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: actionReason.trim(), operationKey: operationKey.trim() || undefined }),
      });
      await loadDetail(selectedId);
      await refreshBatches();
      setMessage('Batch dibalik.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal reverse');
    } finally {
      setBusy(false);
    }
  }

  async function settleLedger() {
    if (!canPost) return;
    setBusy(true);
    setMessage('');
    try {
      await req(token, '/accounting/opening-balance/ledger/settle', {
        method: 'POST',
        body: JSON.stringify({
          documentId: settleDocumentId.trim(),
          financeTransactionId: settleFinanceTransactionId.trim(),
          amount: Number(settleAmount) || 0,
          operationKey: settleOperationKey.trim(),
        }),
      });
      setMessage('Settlement ledger saldo awal diproses.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal settlement');
    } finally {
      setBusy(false);
    }
  }

  async function loadCutover() {
    if (!canView) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await req<CutoverStatus>(token, '/accounting/opening-balance/cutover');
      setCutover(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat cutover');
    } finally {
      setBusy(false);
    }
  }

  async function runCutover() {
    if (!canPost) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await req<CutoverStatus>(token, '/accounting/opening-balance/cutover', { method: 'POST' });
      setCutover(result);
      setMessage(result.ready ? 'Cutover gate lulus.' : 'Cutover gate belum lulus.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menjalankan cutover');
    } finally {
      setBusy(false);
    }
  }

  async function closeYear() {
    if (!canPost) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await req<YearEndRun>(token, '/accounting/opening-balance/year-end', {
        method: 'POST',
        body: JSON.stringify({
          fiscalYear: Number(yearEndFiscalYear),
          retainedEarningsAccountCode: retainedEarningsAccountCode.trim().toUpperCase(),
          incomeSummaryAccountCode: incomeSummaryAccountCode.trim().toUpperCase(),
          operationKey: yearEndOperationKey.trim(),
        }),
      });
      setYearEndRun(result);
      setMessage('Tutup tahun diproses.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal tutup tahun');
    } finally {
      setBusy(false);
    }
  }

  async function reverseYearEnd() {
    if (!canReverse || !yearEndRun?.id) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await req<YearEndRun>(token, '/accounting/opening-balance/year-end/reverse', {
        method: 'POST',
        body: JSON.stringify({
          runId: yearEndRun.id,
          reason: reverseYearEndReason.trim(),
          operationKey: reverseYearEndOperationKey.trim() || undefined,
        }),
      });
      setYearEndRun(result);
      setMessage('Pembalikan tutup tahun diproses.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal reverse tutup tahun');
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return <section className="stack"><Panel eyebrow="OPENING BALANCE" title="Saldo awal & tutup tahun"><p className="sectionHelp">Anda tidak memiliki izin accounting.opening.view.</p></Panel></section>;
  }

  return (
    <section className="stack">
      <Panel eyebrow="OPENING BALANCE" title="Saldo awal & tutup tahun" badge={`${batches.length} batch`}>
        <p className="sectionHelp">
          Kelola batch saldo awal STOCK/AR/AP/GL, validasi, approval, posting, reversal, settlement, cutover gate, dan tutup tahun.
        </p>
        {message && <p className="sectionHelp">{message}</p>}
        <div className="formGrid">
          <label>Tipe batch<select value={type} onChange={(e) => setType(e.target.value)}><option value="STOCK">STOCK</option><option value="AR">AR</option><option value="AP">AP</option><option value="GL">GL</option></select></label>
          <label>Tanggal cutover<input type="date" value={cutoverDate} onChange={(e) => setCutoverDate(e.target.value)} /></label>
          <label>Nama file sumber<input value={sourceFileName} onChange={(e) => setSourceFileName(e.target.value)} /></label>
          <label>Akun kontrol<input value={controlAccountCode} onChange={(e) => setControlAccountCode(e.target.value)} /></label>
          <label>Akun lawan<input value={offsetAccountCode} onChange={(e) => setOffsetAccountCode(e.target.value)} /></label>
          <label>Akun suspense<input value={suspenseAccountCode} onChange={(e) => setSuspenseAccountCode(e.target.value)} /></label>
          <label>Operation key<input value={operationKey} onChange={(e) => setOperationKey(e.target.value)} /></label>
        </div>
        <label>CSV<input value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Opsional" /></label>
        <label>Rows JSON<textarea value={rowsJson} onChange={(e) => setRowsJson(e.target.value)} rows={4} placeholder='[{"accountCode":"1101","debit":100,"credit":0}]' /></label>
        <div className="rowActions">
          {canImport && <button type="button" disabled={busy} onClick={() => void runPreview(true)}>Preview</button>}
          {canImport && <button type="button" disabled={busy} onClick={() => void runPreview(false)}>Buat batch</button>}
        </div>
        {preview && <pre className="sectionHelp">{JSON.stringify(preview, null, 2)}</pre>}
      </Panel>

      <Panel eyebrow="BATCH" title="Daftar batch saldo awal" badge={`${batches.length}`}>
        <Table
          head={['Tipe', 'Status', 'Cutover', 'Debit', 'Kredit', 'Baris', 'Aksi']}
          rows={batches.map((batch) => [
            batch.type,
            <StatusChip status={batch.status} />,
            tanggal(batch.cutoverDate),
            rupiah(batch.totalDebit),
            rupiah(batch.totalCredit),
            `${batch.validRowCount}/${batch.rowCount}`,
            <button type="button" className="secondary" onClick={() => setSelectedId(batch.id)}>Detail</button>,
          ])}
          empty="Belum ada batch saldo awal."
        />
      </Panel>

      {selectedId && detail && (
        <Panel eyebrow="DETAIL" title={`Batch ${detail.id}`} badge={detail.status}>
          <p className="sectionHelp">
            {detail.type} · cutover {tanggal(detail.cutoverDate)} · debit {rupiah(detail.totalDebit)} · kredit {rupiah(detail.totalCredit)}
          </p>
          <div className="formGrid">
            <label>Status baris<select value={rowsStatus} onChange={(e) => setRowsStatus(e.target.value)}><option value="">Semua</option><option value="PENDING">PENDING</option><option value="VALID">VALID</option><option value="ERROR">ERROR</option></select></label>
            <label>Alasan revalidate<input value={revalidateReason} onChange={(e) => setRevalidateReason(e.target.value)} /></label>
            <label>Catatan approval<input value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} /></label>
            <label>Alasan aksi<input value={actionReason} onChange={(e) => setActionReason(e.target.value)} /></label>
          </div>
          <div className="rowActions">
            {canImport && <button type="button" disabled={busy} onClick={() => void revalidateSelected()}>Revalidate</button>}
            {canImport && <button type="button" disabled={busy} onClick={() => void submitSelected()}>Submit</button>}
            {canApprove && <button type="button" disabled={busy} onClick={() => void approveSelected()}>Approve</button>}
            {canImport && <button type="button" disabled={busy} onClick={() => void cancelSelected()}>Cancel</button>}
            {canPost && <button type="button" disabled={busy} onClick={() => void postSelected()}>Post</button>}
            {canReverse && <button type="button" disabled={busy} onClick={() => void reverseSelected()}>Reverse</button>}
          </div>
          <Table
            head={['#', 'Status', 'Akun/Produk/Customer', 'Qty', 'Debit', 'Kredit', 'Total', 'Error']}
            rows={rows.map((row) => [
              row.rowNumber,
              <StatusChip status={row.status} />,
              row.accountCode || row.productId || row.customerId || row.supplierId || row.documentNumber || '-',
              row.quantity ?? '-',
              rupiah(row.debit ?? 0),
              rupiah(row.credit ?? 0),
              rupiah(row.total ?? 0),
              row.errorMessage || '-',
            ])}
            empty="Tidak ada baris."
          />
        </Panel>
      )}

      <Panel eyebrow="SETTLEMENT" title="Settlement ledger saldo awal">
        <div className="formGrid">
          <label>Document ID<input value={settleDocumentId} onChange={(e) => setSettleDocumentId(e.target.value)} /></label>
          <label>Finance transaction ID<input value={settleFinanceTransactionId} onChange={(e) => setSettleFinanceTransactionId(e.target.value)} /></label>
          <label>Jumlah<input value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} /></label>
          <label>Operation key<input value={settleOperationKey} onChange={(e) => setSettleOperationKey(e.target.value)} /></label>
        </div>
        {canPost && <button type="button" disabled={busy} onClick={() => void settleLedger()}>Settle</button>}
      </Panel>

      <Panel eyebrow="CUTOVER" title="Cutover gate" badge={cutover ? (cutover.ready ? 'READY' : 'NOT READY') : undefined}>
        <div className="rowActions">
          {canView && <button type="button" disabled={busy} onClick={() => void loadCutover()}>Muat status</button>}
          {canPost && <button type="button" disabled={busy} onClick={() => void runCutover()}>Jalankan gate</button>}
        </div>
        {cutover && (
          <>
            <p className="sectionHelp">Batch: {cutover.batchCount} · Debit {rupiah(cutover.totals.debit)} · Kredit {rupiah(cutover.totals.credit)} · AR {rupiah(cutover.totals.arOutstanding)} · AP {rupiah(cutover.totals.apOutstanding)}</p>
            <pre className="sectionHelp">{JSON.stringify(cutover.checks, null, 2)}</pre>
          </>
        )}
      </Panel>

      {(mode === 'year-end' || !mode) && (
        <Panel eyebrow="YEAR-END" title="Tutup tahun" badge={yearEndRun?.status}>
          <div className="formGrid">
            <label>Tahun fiskal<input type="number" value={yearEndFiscalYear} onChange={(e) => setYearEndFiscalYear(Number(e.target.value))} /></label>
            <label>Akun laba ditahan<input value={retainedEarningsAccountCode} onChange={(e) => setRetainedEarningsAccountCode(e.target.value)} /></label>
            <label>Akun income summary<input value={incomeSummaryAccountCode} onChange={(e) => setIncomeSummaryAccountCode(e.target.value)} /></label>
            <label>Operation key<input value={yearEndOperationKey} onChange={(e) => setYearEndOperationKey(e.target.value)} /></label>
          </div>
          {canPost && <button type="button" disabled={busy} onClick={() => void closeYear()}>Tutup tahun</button>}
          {yearEndRun && (
            <div className="stack">
              <p className="sectionHelp">Run {yearEndRun.id} · FY{yearEndRun.fiscalYear} · {yearEndRun.status} · net income {rupiah(yearEndRun.netIncome ?? 0)}</p>
              <label>Alasan reverse<input value={reverseYearEndReason} onChange={(e) => setReverseYearEndReason(e.target.value)} /></label>
              <label>Operation key reverse<input value={reverseYearEndOperationKey} onChange={(e) => setReverseYearEndOperationKey(e.target.value)} /></label>
              {canReverse && yearEndRun.status === 'POSTED' && <button type="button" disabled={busy} onClick={() => void reverseYearEnd()}>Reverse tutup tahun</button>}
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

export const OpeningBalanceYearEndView = OpeningBalanceView;
