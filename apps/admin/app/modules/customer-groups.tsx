'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type CustomerGroup = {
  id: string;
  code: string;
  name: string;
  discountPct: number | string;
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

export default function CustomerGroupsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('customer.manage');
  const [rows, setRows] = useState<CustomerGroup[]>([]);
  const [form, setForm] = useState({ code: '', name: '', discountPct: 0 });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setRows(await req<CustomerGroup[]>(token, '/customer-groups'));
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat customer group'));
  }, [token]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/customer-groups', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          discountPct: Number(form.discountPct) || 0,
          isActive: true,
        }),
      });
      setForm({ code: '', name: '', discountPct: 0 });
      await load();
      setMsg('Customer group dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat customer group');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: CustomerGroup) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/customer-groups/${row.id}`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
      setMsg(row.isActive ? 'Customer group dinonaktifkan.' : 'Customer group diaktifkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengubah status customer group');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="CUSTOMER GROUP" title="Customer Group" badge={`${rows.filter((x) => x.isActive).length} aktif`}>
        <p className="sectionHelp">Grup pelanggan dengan diskon persentase. Lifecycle aktif/nonaktif menggunakan endpoint tenant-scoped yang sama dengan create.</p>
        <form className="formStack" onSubmit={create}>
          <div className="formGrid">
            <label>Kode<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RETAIL" /></label>
            <label>Nama<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Retail" /></label>
          </div>
          <label>Diskon (%)<input type="number" min="0" max="100" step="0.01" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: Number(e.target.value) || 0 })} /></label>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Simpan customer group</button>}
          </div>
        </form>
        <Table
          head={['Kode', 'Nama', 'Diskon', 'Status', 'Aksi']}
          rows={rows.map((row) => [
            <strong key={`${row.id}-code`}>{row.code}</strong>,
            row.name,
            `${Number(row.discountPct)}%`,
            <StatusChip key={`${row.id}-status`} status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            canManage ? (
              <button key={`${row.id}-toggle`} type="button" className="secondary" disabled={busy} onClick={() => void toggle(row)}>
                {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            ) : null,
          ])}
          empty="Belum ada customer group"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}
