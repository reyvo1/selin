'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Supplier = { id: string; name: string; code?: string; phone?: string | null; isActive?: boolean };

type SupplierDeposit = {
  id: string;
  supplierId: string;
  amount: number | string;
  balance: number | string;
  status: string;
  createdAt?: string;
};

type SupplierPage = { items: Supplier[]; pageInfo?: { limit: number; nextCursor: string | null; hasMore: boolean } };

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(`${API}${path}`, token, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message ?? 'Request gagal');
  return d as T;
}

export default function SupplierDepositsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canCreate = canAll('supplier.create');
  const canApply = canAll('supplier.update');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [deposits, setDeposits] = useState<SupplierDeposit[]>([]);
  const [createAmount, setCreateAmount] = useState<number | string>('');
  const [applyAmounts, setApplyAmounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadSuppliers() {
    const page = await req<SupplierPage>(token, '/suppliers?limit=100&includeInactive=true');
    setSuppliers(Array.isArray(page?.items) ? page.items : []);
  }

  async function loadDeposits(supplierId?: string) {
    if (supplierId) {
      setDeposits(await req<SupplierDeposit[]>(token, `/supplier-deposits?supplierId=${encodeURIComponent(supplierId)}`));
      return;
    }
    setDeposits(await req<SupplierDeposit[]>(token, '/supplier-deposits'));
  }

  useEffect(() => {
    void loadSuppliers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat supplier'));
    void loadDeposits().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat deposit'));
  }, [token]);

  useEffect(() => {
    void loadDeposits(selectedSupplierId || undefined).catch((e) =>
      setMsg(e instanceof Error ? e.message : 'Gagal memuat deposit'),
    );
  }, [selectedSupplierId, token]);

  async function createDeposit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate || !selectedSupplierId) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/supplier-deposits', {
        method: 'POST',
        body: JSON.stringify({ supplierId: selectedSupplierId, amount: Number(createAmount) || 0 }),
      });
      setCreateAmount('');
      await loadDeposits(selectedSupplierId || undefined);
      setMsg('Deposit supplier dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat deposit supplier');
    } finally {
      setBusy(false);
    }
  }

  async function applyDeposit(deposit: SupplierDeposit) {
    if (!canApply) return;
    setBusy(true);
    setMsg('');
    try {
      const amount = applyAmounts[deposit.id];
      await req(token, `/supplier-deposits/${deposit.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ amount: amount ? Number(amount) : undefined }),
      });
      setApplyAmounts((prev) => ({ ...prev, [deposit.id]: '' }));
      await loadDeposits(selectedSupplierId || undefined);
      setMsg('Deposit diterapkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menerapkan deposit');
    } finally {
      setBusy(false);
    }
  }

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  return (
    <section className="stack">
      <Panel eyebrow="SUPPLIER DEPOSIT" title="Deposit Supplier" badge={`${deposits.length} deposit`}>
        <p className="sectionHelp">
          Buat deposit supplier dan terapkan saldo deposit ke transaksi. Daftar dapat difilter per supplier.
        </p>
        <div className="formGrid">
          <label>
            Supplier
            <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
              <option value="">Semua supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canCreate && (
          <form className="formStack" onSubmit={createDeposit}>
            <div className="formGrid">
              <label>
                Jumlah deposit
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="actionRow">
              <button disabled={busy || !selectedSupplierId}>Buat deposit</button>
            </div>
          </form>
        )}
        <Table
          head={['Supplier', 'Jumlah', 'Saldo', 'Status', 'Terapkan', 'Aksi']}
          rows={deposits.map((deposit) => [
            <strong key={`${deposit.id}-supplier`}>{supplierName(deposit.supplierId)}</strong>,
            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(deposit.amount)),
            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(deposit.balance)),
            <StatusChip key={`${deposit.id}-status`} status={deposit.status} />,
            canApply ? (
              <input
                key={`${deposit.id}-apply-amount`}
                type="number"
                min="0"
                step="0.01"
                placeholder="Jumlah"
                value={applyAmounts[deposit.id] ?? ''}
                onChange={(e) => setApplyAmounts((prev) => ({ ...prev, [deposit.id]: e.target.value }))}
              />
            ) : null,
            canApply ? (
              <button
                key={`${deposit.id}-apply`}
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void applyDeposit(deposit)}
              >
                Apply
              </button>
            ) : null,
          ])}
          empty="Belum ada deposit supplier"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}