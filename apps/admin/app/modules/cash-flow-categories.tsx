'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type CashFlowCategory = {
  id: string;
  code: string;
  name: string;
  kind: string;
  isActive: boolean;
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

export default function CashFlowCategoriesView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('finance.create');
  const [rows, setRows] = useState<CashFlowCategory[]>([]);
  const [form, setForm] = useState({ code: '', name: '', kind: 'OPERATING' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setRows(await req<CashFlowCategory[]>(token, '/cash-flow-categories'));
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat kategori arus kas'));
  }, [token]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/cash-flow-categories', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          kind: form.kind.trim() || 'OPERATING',
        }),
      });
      setForm({ code: '', name: '', kind: 'OPERATING' });
      await load();
      setMsg('Kategori arus kas dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat kategori arus kas');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: CashFlowCategory) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/cash-flow-categories/${row.id}`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
      setMsg(row.isActive ? 'Kategori arus kas dinonaktifkan.' : 'Kategori arus kas diaktifkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengubah status kategori arus kas');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="CASH FLOW CATEGORY" title="Kategori Arus Kas" badge={`${rows.filter((x) => x.isActive).length} aktif`}>
        <p className="sectionHelp">Kategori arus kas tenant-scoped. Lifecycle aktif/nonaktif menggunakan endpoint yang sama dengan create/update.</p>
        <form className="formStack" onSubmit={create}>
          <div className="formGrid">
            <label>Kode<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="OPERATING" /></label>
            <label>Nama<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Operasional" /></label>
            <label>Jenis<input required value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="OPERATING" /></label>
          </div>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Simpan kategori arus kas</button>}
          </div>
        </form>
        <Table
          head={['Kode', 'Nama', 'Jenis', 'Status', 'Aksi']}
          rows={rows.map((row) => [
            <strong key={`${row.id}-code`}>{row.code}</strong>,
            row.name,
            row.kind,
            <StatusChip key={`${row.id}-status`} status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            canManage ? (
              <button key={`${row.id}-toggle`} type="button" className="secondary" disabled={busy} onClick={() => void toggle(row)}>
                {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            ) : null,
          ])}
          empty="Belum ada kategori arus kas"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}