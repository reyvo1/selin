'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Cheque = {
  id: string;
  direction: string;
  number: string;
  partyType: string;
  partyId: string;
  amount: number | string;
  status: string;
  dueDate?: string | null;
  createdAt?: string;
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

const TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['DEPOSITED'],
  DEPOSITED: ['CLEARED', 'BOUNCED'],
  ISSUED: ['CLEARED', 'BOUNCED'],
};

export default function ChequesView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('finance.create');
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [form, setForm] = useState({
    direction: 'AR',
    number: '',
    partyType: 'CUSTOMER',
    partyId: '',
    amount: '',
    dueDate: '',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadCheques() {
    const data = await req<{ items?: Cheque[] } | Cheque[]>(token, '/cheques');
    setCheques(Array.isArray(data) ? data : data.items ?? []);
  }

  useEffect(() => {
    void loadCheques().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat cheque'));
  }, [token]);

  async function createCheque(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/cheques', {
        method: 'POST',
        body: JSON.stringify({
          direction: form.direction,
          number: form.number,
          partyType: form.partyType,
          partyId: form.partyId,
          amount: Number(form.amount) || 0,
          dueDate: form.dueDate || null,
        }),
      });
      setForm({ direction: 'AR', number: '', partyType: 'CUSTOMER', partyId: '', amount: '', dueDate: '' });
      await loadCheques();
      setMsg('Cheque dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat cheque');
    } finally {
      setBusy(false);
    }
  }

  async function transition(cheque: Cheque, status: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/cheques/${cheque.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await loadCheques();
      setMsg(`Status cheque ${cheque.number} diperbarui.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal transisi status cheque');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="CHEQUE" title="Cheque AR/AP" badge={`${cheques.length} cheque`}>
        <p className="sectionHelp">
          Kelola cheque piutang (AR) dan hutang (AP), termasuk transisi status.
        </p>
        {canManage && (
          <form className="formStack" onSubmit={createCheque}>
            <div className="formGrid">
              <label>
                Direction
                <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                  <option value="AR">AR (Piutang)</option>
                  <option value="AP">AP (Hutang)</option>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </label>
              <label>
                Number
                <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </label>
              <label>
                Party type
                <select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value })}>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="SUPPLIER">SUPPLIER</option>
                </select>
              </label>
              <label>
                Party ID
                <input required value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
              </label>
              <label>
                Amount
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label>
                Due date
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </label>
            </div>
            <div className="actionRow">
              <button disabled={busy}>Buat cheque</button>
            </div>
          </form>
        )}
        <Table
          head={['Nomor', 'Direction', 'Party', 'Jumlah', 'Status', 'Jatuh tempo', 'Aksi']}
          rows={cheques.map((cheque) => [
            <strong key={`${cheque.id}-number`}>{cheque.number}</strong>,
            cheque.direction,
            `${cheque.partyType}: ${cheque.partyId}`,
            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(cheque.amount)),
            <StatusChip key={`${cheque.id}-status`} status={cheque.status} />,
            cheque.dueDate ? new Date(cheque.dueDate).toLocaleDateString('id-ID') : '-',
            canManage ? (
              <div key={`${cheque.id}-actions`} className="rowActions">
                {(TRANSITIONS[cheque.status] ?? []).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void transition(cheque, status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            ) : null,
          ])}
          empty="Belum ada cheque"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
      {/*
        Compatibility endpoints exposed by the same controller:
        POST /cheques/:id/status
        POST /cheques/:id/transition
        POST /cheques/:id/transition-status
      */}
    </section>
  );
}
