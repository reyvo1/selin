'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Customer = { id: string; name: string; phone?: string | null; email?: string | null };

type CustomerDeposit = {
  id: string;
  customerId: string;
  amount: number | string;
  balance: number | string;
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

export default function CustomerDepositsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('customer.manage');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deposits, setDeposits] = useState<CustomerDeposit[]>([]);
  const [createAmount, setCreateAmount] = useState<number | string>('');
  const [applyAmounts, setApplyAmounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadCustomers() {
    setCustomers(await req<Customer[]>(token, '/master-data/customers'));
  }

  async function loadDeposits(customerId?: string) {
    if (customerId) {
      setDeposits(await req<CustomerDeposit[]>(token, `/customer-deposits/customer/${customerId}`));
      return;
    }
    setDeposits(await req<CustomerDeposit[]>(token, '/customer-deposits'));
  }

  useEffect(() => {
    void loadCustomers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat pelanggan'));
    void loadDeposits().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat deposit'));
  }, [token]);

  useEffect(() => {
    void loadDeposits(selectedCustomerId || undefined).catch((e) =>
      setMsg(e instanceof Error ? e.message : 'Gagal memuat deposit'),
    );
  }, [selectedCustomerId, token]);

  async function createDeposit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedCustomerId) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/customer-deposits', {
        method: 'POST',
        body: JSON.stringify({ customerId: selectedCustomerId, amount: Number(createAmount) || 0 }),
      });
      setCreateAmount('');
      await loadDeposits(selectedCustomerId || undefined);
      setMsg('Deposit pelanggan dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat deposit pelanggan');
    } finally {
      setBusy(false);
    }
  }

  async function applyDeposit(deposit: CustomerDeposit) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      const amount = applyAmounts[deposit.id];
      await req(token, `/customer-deposits/${deposit.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ amount: amount ? Number(amount) : undefined }),
      });
      setApplyAmounts((prev) => ({ ...prev, [deposit.id]: '' }));
      await loadDeposits(selectedCustomerId || undefined);
      setMsg('Deposit diterapkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menerapkan deposit');
    } finally {
      setBusy(false);
    }
  }

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  return (
    <section className="stack">
      <Panel eyebrow="CUSTOMER DEPOSIT" title="Deposit Pelanggan" badge={`${deposits.length} deposit`}>
        <p className="sectionHelp">
          Buat deposit pelanggan dan terapkan saldo deposit ke transaksi. Daftar dapat difilter per pelanggan.
        </p>
        <div className="formGrid">
          <label>
            Pelanggan
            <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">Semua pelanggan</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canManage && (
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
              <button disabled={busy || !selectedCustomerId}>Buat deposit</button>
            </div>
          </form>
        )}
        <Table
          head={['Pelanggan', 'Jumlah', 'Saldo', 'Status', 'Terapkan', 'Aksi']}
          rows={deposits.map((deposit) => [
            <strong key={`${deposit.id}-customer`}>{customerName(deposit.customerId)}</strong>,
            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(deposit.amount)),
            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(deposit.balance)),
            <StatusChip key={`${deposit.id}-status`} status={deposit.status} />,
            canManage ? (
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
            canManage ? (
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
          empty="Belum ada deposit pelanggan"
        />
      </Panel>
      {msg && <div className="notice">{msg}</div>}
      {/*
        Compatibility endpoints exposed by the same controller:
        GET /customer-deposits/:customerId
        POST /customer-deposits/apply
      */}
    </section>
  );
}
