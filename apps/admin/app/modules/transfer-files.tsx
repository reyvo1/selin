'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type TransferFile = {
  id: string;
  direction: string;
  fileName: string;
  status: string;
  rowIngested?: number;
  rowRejected?: number;
  createdAt?: string;
  updatedAt?: string;
};
type ExportResult = {
  fileId: string;
  fileName: string;
  rowIngested: number;
  exportPayload: { branchId: string; rows: unknown[] };
};

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(`${API}${path}`, token, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message ?? 'Request gagal');
  return d as T;
}

export default function TransferFilesView({ token }: { token: string }) {
  const { canAll, identity } = usePermissions(token);
  const canManage = Boolean(identity?.roles.some((r) => ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAREHOUSE'].includes(r))) && canAll('manufacturing.manage');

  const [items, setItems] = useState<TransferFile[]>([]);
  const [form, setForm] = useState({ direction: 'INBOUND', fileName: '' });
  const [exportDir, setExportDir] = useState<'INBOUND' | 'OUTBOUND'>('OUTBOUND');
  const [exportLimit, setExportLimit] = useState('500');
  const [importBranchId, setImportBranchId] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await req<TransferFile[] | { items?: TransferFile[] }>(token, '/transfer-files');
    setItems(Array.isArray(data) ? data : data.items ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat transfer file'));
  }, [token]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/transfer-files', {
        method: 'POST',
        body: JSON.stringify({ direction: form.direction, fileName: form.fileName }),
      });
      setForm({ direction: 'INBOUND', fileName: '' });
      await load();
      setMsg('Transfer file dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat transfer file');
    } finally {
      setBusy(false);
    }
  }

  /** F09: export transaksi branch ke payload JSON. */
  async function exportTransactions() {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await req<ExportResult>(token, '/transfer-files/export', {
        method: 'POST',
        body: JSON.stringify({ direction: exportDir, limit: Number(exportLimit) || 500 }),
      });
      setLastExport(result);
      await load();
      setMsg(`Export ${result.rowIngested} transaksi ke ${result.fileName}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal export transaksi');
    } finally {
      setBusy(false);
    }
  }

  /** F10: import transaksi cabang dari payload JSON. */
  async function importTransactions(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await req<{ duplicate: boolean; fileId: string; rowIngested: number; rowRejected: number }>(
        token,
        '/transfer-files/import',
        {
          method: 'POST',
          body: JSON.stringify({
            direction: 'INBOUND',
            fileName: importFileName || `import-${Date.now()}.json`,
            payload: {
              branchId: importBranchId,
              transactions: lastExport?.exportPayload.rows.map((row) => ({
                type: String((row as { type?: string }).type ?? 'UNKNOWN'),
                refId: String((row as { refId?: string }).refId ?? ''),
                amount: Number((row as { amount?: number }).amount ?? 0),
                timestamp: String((row as { timestamp?: string }).timestamp ?? new Date().toISOString()),
              })) ?? [],
            },
          }),
        },
      );
      setImportBranchId('');
      setImportFileName('');
      await load();
      setMsg(result.duplicate
        ? `File ${result.fileId} sudah diproses sebelumnya (replay).`
        : `Import selesai: ${result.rowIngested} diterima, ${result.rowRejected} ditolak.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal import transaksi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="moduleStack">
      <Panel eyebrow="TRANSFER FILE" title="Transfer file" badge={`${items.length} file`}>
        <form className="formStack" onSubmit={create}>
          <div className="grid2">
            <label>
              Direction
              <select required value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="INBOUND">INBOUND</option>
                <option value="OUTBOUND">OUTBOUND</option>
              </select>
            </label>
            <label>
              File name
              <input required value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} />
            </label>
          </div>
          {canManage && <button disabled={busy}>Buat transfer file</button>}
        </form>
        {msg && <div className="notice">{msg}</div>}
      </Panel>

      {canManage && (
        <Panel eyebrow="EXPORT TRANSAKSI" title="Export transaksi cabang" badge={lastExport ? `${lastExport.rowIngested} baris` : ''}>
          <p className="sectionHelp">
            Ekspor audit log transaksi cabang ke payload JSON untuk dikirim ke branch tujuan atau server pusat (F09).
            Payload ini dapat di-import kembali di branch tujuan (F10).
          </p>
          <div className="grid2">
            <label>
              Direction
              <select value={exportDir} onChange={(e) => setExportDir(e.target.value as 'INBOUND' | 'OUTBOUND')}>
                <option value="OUTBOUND">OUTBOUND</option>
                <option value="INBOUND">INBOUND</option>
              </select>
            </label>
            <label>
              Limit (maks 5000)
              <input type="number" min="1" max="5000" value={exportLimit} onChange={(e) => setExportLimit(e.target.value)} />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void exportTransactions()}>
            Export transaksi
          </button>
          {lastExport && (
            <p className="sectionHelp">
              File <code>{lastExport.fileName}</code> — {lastExport.rowIngested} baris. ID file: {lastExport.fileId}.
            </p>
          )}
        </Panel>
      )}

      {canManage && (
        <Panel eyebrow="IMPORT TRANSAKSI" title="Import transaksi cabang" badge="">
          <p className="sectionHelp">
            Import transaksi dari branch lain (F10). Payload wajib berasal dari export F09 (sumber yang sama).
            Operasi idempoten via checksum: replay file yang sama tidak mengulang pemrosesan.
          </p>
          <form className="formStack" onSubmit={(e) => void importTransactions(e)}>
            <div className="grid2">
              <label>
                Branch tujuan (branchId)
                <input
                  required
                  value={importBranchId}
                  onChange={(e) => setImportBranchId(e.target.value)}
                  placeholder="UUID branch tujuan"
                />
              </label>
              <label>
                Nama file (opsional)
                <input value={importFileName} onChange={(e) => setImportFileName(e.target.value)} placeholder="import.json" />
              </label>
            </div>
            <button disabled={busy || !lastExport}>Import dari export terakhir</button>
          </form>
        </Panel>
      )}

      <Panel eyebrow="DAFTAR" title="Riwayat transfer file" badge={`${items.length} file`}>
        <Table
          head={['Waktu', 'Direction', 'File', 'Status', 'Baris OK', 'Baris Gagal']}
          rows={items.map((item) => [
            item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-',
            item.direction,
            item.fileName,
            <StatusChip status={item.status} />,
            item.rowIngested ?? 0,
            item.rowRejected ?? 0,
          ])}
          empty="Belum ada transfer file."
        />
      </Panel>
    </section>
  );
}
