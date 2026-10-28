'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type NumberSequence = {
  id: string;
  companyId: string;
  branchId?: string | null;
  documentType: string;
  prefix: string;
  format: string;
  padding: number;
  resetPolicy: string;
  nextNumber: number;
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

export default function NumberSequencesView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('platform.configure');
  const [rows, setRows] = useState<NumberSequence[]>([]);
  const [form, setForm] = useState({ documentType: '', prefix: '', format: '{PREFIX}-{SCOPE}-{YYYY}{MM}-{NUMBER}', padding: 6, resetPolicy: 'MONTHLY', branchId: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setRows(await req<NumberSequence[]>(token, '/number-sequences'));
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat penomoran'));
  }, [token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/number-sequences', {
        method: 'POST',
        body: JSON.stringify({
          documentType: form.documentType.trim().toUpperCase(),
          prefix: form.prefix.trim() || form.documentType.trim().toUpperCase(),
          format: form.format.trim(),
          padding: Number(form.padding) || 6,
          resetPolicy: form.resetPolicy,
          branchId: form.branchId.trim() || null,
        }),
      });
      setForm({ documentType: '', prefix: '', format: '{PREFIX}-{SCOPE}-{YYYY}{MM}-{NUMBER}', padding: 6, resetPolicy: 'MONTHLY', branchId: '' });
      await load();
      setMsg('Konfigurasi penomoran disimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan penomoran');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="PENOMORAN" title="Penomoran Dokumen" badge={`${rows.length} sequence`}>
        <p className="sectionHelp">Konfigurasi prefix, format, padding, dan reset periode per company/branch/document type. Sequence per company/branch/document type digunakan oleh seluruh transaksi.</p>
        <form className="formStack" onSubmit={save}>
          <div className="formGrid">
            <label>Tipe Dokumen<input required value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} placeholder="SALE" /></label>
            <label>Prefix<input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="SLS" /></label>
          </div>
          <label>Format<input required value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="{PREFIX}-{SCOPE}-{YYYY}{MM}-{NUMBER}" /></label>
          <div className="formGrid">
            <label>Padding<input type="number" min="1" max="12" value={form.padding} onChange={(e) => setForm({ ...form, padding: Number(e.target.value) || 6 })} /></label>
            <label>Reset<select value={form.resetPolicy} onChange={(e) => setForm({ ...form, resetPolicy: e.target.value })}><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option><option value="NEVER">Tidak pernah</option></select></label>
          </div>
          <label>Branch ID (opsional)<input value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} placeholder="kosong = company" /></label>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Simpan penomoran</button>}
          </div>
        </form>
        <Table
          head={['Tipe', 'Prefix', 'Format', 'Padding', 'Reset', 'Next', 'Branch']}
          rows={rows.map((row) => [
            <strong key={`${row.id}-type`}>{row.documentType}</strong>,
            row.prefix,
            <code key={`${row.id}-format`}>{row.format}</code>,
            row.padding,
            row.resetPolicy,
            row.nextNumber,
            row.branchId ?? 'COMPANY',
          ])}
          empty="Belum ada konfigurasi penomoran"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}
