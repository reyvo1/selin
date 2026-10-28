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
  createdAt?: string;
  updatedAt?: string;
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
      <Panel eyebrow="DAFTAR" title="Riwayat transfer file" badge={`${items.length} file`}>
        <Table
          head={['Waktu', 'Direction', 'File', 'Status']}
          rows={items.map((item) => [
            item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-',
            item.direction,
            item.fileName,
            <StatusChip status={item.status} />,
          ])}
          empty="Belum ada transfer file."
        />
      </Panel>
    </section>
  );
}