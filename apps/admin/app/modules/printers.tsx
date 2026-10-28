'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Printer = {
  id: string;
  companyId: string;
  branchId?: string | null;
  name: string;
  station?: string | null;
  type: string;
  connection: string;
  paperWidth: 58 | 80;
  isDefault: boolean;
  isActive: boolean;
};

type PrintJob = {
  id: string;
  companyId: string;
  branchId?: string | null;
  printerId?: string | null;
  printerName?: string | null;
  documentType: string;
  referenceId?: string | null;
  status: string;
  attempts: number;
  error?: string | null;
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

export default function PrintersView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('platform.configure');
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [form, setForm] = useState({ name: '', station: '', type: 'rawbt', connection: 'rawbt', paperWidth: 58, branchId: '', isDefault: false, isActive: true });
  const [jobForm, setJobForm] = useState({ printerId: '', documentType: 'RECEIPT', referenceId: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [p, j] = await Promise.all([
      req<Printer[]>(token, '/printers'),
      req<PrintJob[]>(token, '/print-jobs'),
    ]);
    setPrinters(p);
    setJobs(j);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat printer'));
  }, [token]);

  async function savePrinter(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/printers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          station: form.station.trim() || null,
          type: form.type,
          connection: form.connection,
          paperWidth: Number(form.paperWidth) || 58,
          branchId: form.branchId.trim() || null,
          isDefault: form.isDefault,
          isActive: form.isActive,
        }),
      });
      setForm({ name: '', station: '', type: 'rawbt', connection: 'rawbt', paperWidth: 58, branchId: '', isDefault: false, isActive: true });
      await load();
      setMsg('Konfigurasi printer disimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan printer');
    } finally {
      setBusy(false);
    }
  }

  async function createJob(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          printerId: jobForm.printerId || null,
          documentType: jobForm.documentType.trim().toUpperCase() || 'RECEIPT',
          referenceId: jobForm.referenceId.trim() || null,
        }),
      });
      setJobForm({ printerId: '', documentType: 'RECEIPT', referenceId: '' });
      await load();
      setMsg('Print job dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat print job');
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(id: string) {
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/print-jobs/${id}/retry`, { method: 'POST' });
      await load();
      setMsg('Print job diulang.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengulang print job');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="PRINTER" title="Konfigurasi Printer & Print Job" badge={`${printers.length} printer`}>
        <p className="sectionHelp">Konfigurasi printer/station POS (thermal USB/Bluetooth, RawBT, browser) dan antrean print job dengan status dan retry.</p>
        <form className="formStack" onSubmit={savePrinter}>
          <div className="formGrid">
            <label>Nama Printer<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Printer Kasir 1" /></label>
            <label>Station<input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} placeholder="KASIR-1" /></label>
          </div>
          <div className="formGrid">
            <label>Tipe<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="rawbt">RawBT</option><option value="thermal_usb">Thermal USB</option><option value="thermal_bluetooth">Thermal Bluetooth</option><option value="browser">Browser</option></select></label>
            <label>Koneksi<select value={form.connection} onChange={(e) => setForm({ ...form, connection: e.target.value })}><option value="rawbt">RawBT</option><option value="usb">USB</option><option value="bluetooth">Bluetooth</option><option value="browser">Browser</option></select></label>
          </div>
          <div className="formGrid">
            <label>Lebar Kertas (mm)<select value={form.paperWidth} onChange={(e) => setForm({ ...form, paperWidth: Number(e.target.value) as 58 | 80 })}><option value={58}>58</option><option value={80}>80</option></select></label>
            <label>Branch ID (opsional)<input value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} placeholder="kosong = company" /></label>
          </div>
          <div className="formGrid">
            <label><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
            <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktif</label>
          </div>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Simpan printer</button>}
          </div>
        </form>
        <Table
          head={['Nama', 'Station', 'Tipe', 'Koneksi', 'Kertas', 'Default', 'Aktif']}
          rows={printers.map((row) => [
            <strong key={`${row.id}-name`}>{row.name}</strong>,
            row.station ?? '-',
            row.type,
            row.connection,
            `${row.paperWidth}mm`,
            row.isDefault ? 'Ya' : '-',
            row.isActive ? 'Ya' : 'Tidak',
          ])}
          empty="Belum ada konfigurasi printer"
        />
      </Panel>

      <Panel eyebrow="PRINT JOB" title="Antrean Print Job" badge={`${jobs.length} job`}>
        <form className="formStack" onSubmit={createJob}>
          <div className="formGrid">
            <label>Printer<select value={jobForm.printerId} onChange={(e) => setJobForm({ ...jobForm, printerId: e.target.value })}>
              <option value="">(default)</option>
              {printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
            <label>Tipe Dokumen<input value={jobForm.documentType} onChange={(e) => setJobForm({ ...jobForm, documentType: e.target.value })} placeholder="RECEIPT" /></label>
          </div>
          <label>Reference ID<input value={jobForm.referenceId} onChange={(e) => setJobForm({ ...jobForm, referenceId: e.target.value })} placeholder="SALE-001" /></label>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Buat print job</button>}
          </div>
        </form>
        <Table
          head={['Dokumen', 'Printer', 'Status', 'Attempt', 'Error', 'Aksi']}
          rows={jobs.map((row) => [
            <strong key={`${row.id}-doc`}>{row.documentType}</strong>,
            row.printerName ?? row.printerId ?? '-',
            row.status,
            row.attempts,
            row.error ?? '-',
            canManage && row.status === 'failed' ? <button type="button" className="secondary" onClick={() => retryJob(row.id)} disabled={busy}>Retry</button> : null,
          ])}
          empty="Belum ada print job"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}
