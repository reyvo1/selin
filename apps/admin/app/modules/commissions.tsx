'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type CommissionRule = {
  id: string;
  name: string;
  basis: string;
  rate: number | string;
  isActive: boolean;
  createdAt?: string;
};

type CommissionPayout = {
  id: string;
  salespersonId: string;
  periodStart: string;
  periodEnd: string;
  amount: number | string;
  status: string;
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

export default function CommissionsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('manufacturing.manage');
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [form, setForm] = useState({ name: '', basis: 'REVENUE', rate: 0 });
  const [computeForm, setComputeForm] = useState({ periodStart: '', periodEnd: '', salespersonId: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [r, p] = await Promise.all([
      req<CommissionRule[]>(token, '/commissions/rules'),
      req<CommissionPayout[]>(token, '/commissions/payouts'),
    ]);
    setRules(r);
    setPayouts(p);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat commission'));
  }, [token]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/commissions/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          basis: form.basis,
          rate: Number(form.rate) || 0,
        }),
      });
      setForm({ name: '', basis: 'REVENUE', rate: 0 });
      await load();
      setMsg('Commission rule dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat commission rule');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rule: CommissionRule) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/commissions/rules/${rule.id}`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      await load();
      setMsg(rule.isActive ? 'Commission rule dinonaktifkan.' : 'Commission rule diaktifkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengubah status commission rule');
    } finally {
      setBusy(false);
    }
  }

  async function computePayout(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/commissions/payouts/compute', {
        method: 'POST',
        body: JSON.stringify({
          periodStart: computeForm.periodStart,
          periodEnd: computeForm.periodEnd,
          salespersonId: computeForm.salespersonId.trim() || undefined,
        }),
      });
      await load();
      setMsg('Commission payout dihitung.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menghitung commission payout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="COMMISSION RULES" title="Commission Rules" badge={`${rules.filter((x) => x.isActive).length} aktif`}>
        <p className="sectionHelp">Aturan komisi: nama, basis, dan rate. Lifecycle aktif/nonaktif menggunakan endpoint tenant-scoped.</p>
        <form className="formStack" onSubmit={create}>
          <div className="formGrid">
            <label>Nama<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Komisi Sales" /></label>
            <label>Basis<select value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })}>
              <option value="REVENUE">REVENUE</option>
              <option value="PROFIT">PROFIT</option>
              <option value="QUANTITY">QUANTITY</option>
            </select></label>
          </div>
          <label>Rate<input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) || 0 })} /></label>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Simpan commission rule</button>}
          </div>
        </form>
        <Table
          head={['Nama', 'Basis', 'Rate', 'Status', 'Aksi']}
          rows={rules.map((row) => [
            <strong key={`${row.id}-name`}>{row.name}</strong>,
            row.basis,
            `${Number(row.rate)}%`,
            <StatusChip key={`${row.id}-status`} status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            canManage ? (
              <button key={`${row.id}-toggle`} type="button" className="secondary" disabled={busy} onClick={() => void toggle(row)}>
                {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            ) : null,
          ])}
          empty="Belum ada commission rule"
        />
      </Panel>

      <Panel eyebrow="COMMISSION PAYOUTS" title="Commission Payouts" badge={`${payouts.length} payout`}>
        <form className="formStack" onSubmit={computePayout}>
          <div className="formGrid">
            <label>Periode Mulai<input type="date" required value={computeForm.periodStart} onChange={(e) => setComputeForm({ ...computeForm, periodStart: e.target.value })} /></label>
            <label>Periode Akhir<input type="date" required value={computeForm.periodEnd} onChange={(e) => setComputeForm({ ...computeForm, periodEnd: e.target.value })} /></label>
          </div>
          <label>Salesperson ID (opsional)<input value={computeForm.salespersonId} onChange={(e) => setComputeForm({ ...computeForm, salespersonId: e.target.value })} /></label>
          <div className="actionRow">
            {canManage && <button disabled={busy}>Hitung commission payout</button>}
          </div>
        </form>
        <Table
          head={['Salesperson', 'Periode Mulai', 'Periode Akhir', 'Jumlah', 'Status']}
          rows={payouts.map((row) => [
            row.salespersonId,
            row.periodStart ? new Date(row.periodStart).toLocaleDateString('id-ID') : '-',
            row.periodEnd ? new Date(row.periodEnd).toLocaleDateString('id-ID') : '-',
            `${Number(row.amount)}`,
            <StatusChip key={`${row.id}-status`} status={row.status} />,
          ])}
          empty="Belum ada commission payout"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}
