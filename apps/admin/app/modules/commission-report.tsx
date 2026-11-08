'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table, rupiah } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type SalespersonCommission = {
  salespersonId: string;
  salespersonName: string;
  orderCount: number;
  totalSales: string;
  settledSales: string;
  commissionRate: string;
  commissionAmount: string;
};

type CommissionRule = {
  id: string;
  name: string;
  basis: string;
  rate: string;
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

export default function CommissionReportView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canView = canAll('commission.view');
  const [commissions, setCommissions] = useState<SalespersonCommission[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    if (!canView) return;
    try {
      const [comm, rul] = await Promise.all([
        req<SalespersonCommission[]>(token, `/commissions/report/salesperson?from=${from}&to=${to}`),
        req<CommissionRule[]>(token, '/commissions/report/rule'),
      ]);
      setCommissions(comm ?? []);
      setRules(rul ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat laporan');
    }
  }

  useEffect(() => { void load(); }, [token, from, to]);

  return (
    <section className="stack">
      {msg && <p className="sectionHelp">{msg}</p>}
      <Panel eyebrow="COMMISSION REPORT" title="Laporan Komisi Salesperson" badge={`${commissions.length} salesperson`}>
        <div className="formStack">
          <div className="grid2">
            <label>Dari<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>Sampai<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <button type="button" onClick={() => void load()}>Muat laporan</button>
        </div>
        <Table
          head={['Salesperson', 'Order', 'Total Penjualan', 'Rate', 'Komisi']}
          rows={commissions.map((c) => [
            c.salespersonName ?? c.salespersonId,
            c.orderCount,
            rupiah(c.settledSales),
            `${c.commissionRate}%`,
            rupiah(c.commissionAmount),
          ])}
          empty="Belum ada data komisi."
        />
      </Panel>
      <Panel eyebrow="COMMISSION RULES" title="Aturan Komisi" badge={`${rules.length} aturan`}>
        <Table
          head={['Nama', 'Basis', 'Rate', 'Status']}
          rows={rules.map((r) => [
            r.name,
            r.basis,
            `${r.rate}%`,
            r.isActive ? 'Aktif' : 'Nonaktif',
          ])}
          empty="Belum ada aturan komisi."
        />
      </Panel>
    </section>
  );
}
