'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Supplier = { id: string; name: string; code?: string; isActive?: boolean };
type Customer = { id: string; name: string };
type Product = { id: string; name: string; salePrice: number | string };
type ConsignmentItemDraft = { productId: string; quantity: string; unitPrice: string };
type Consignment = {
  id: string;
  number: string;
  supplierId?: string | null;
  customerId?: string | null;
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

export default function ConsignmentsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('sales.manage');

  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [number, setNumber] = useState('');
  const [items, setItems] = useState<ConsignmentItemDraft[]>([]);
  const [draft, setDraft] = useState<ConsignmentItemDraft>({ productId: '', quantity: '1', unitPrice: '' });

  const [settleAmounts, setSettleAmounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadConsignments() {
    setConsignments(await req<Consignment[]>(token, '/consignments'));
  }

  async function loadSuppliers() {
    const page = await req<{ items?: Supplier[] } | Supplier[]>(token, '/suppliers?limit=100&includeInactive=true');
    setSuppliers(Array.isArray(page) ? page : (page.items ?? []));
  }

  async function loadCustomers() {
    setCustomers(await req<Customer[]>(token, '/master-data/customers'));
  }

  async function loadProducts() {
    const d = await req<{ items?: Product[] }>(token, '/products?limit=100&includeInactive=true');
    setProducts(d.items ?? []);
  }

  useEffect(() => {
    void loadConsignments().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat consignment'));
    void loadSuppliers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat supplier'));
    void loadCustomers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat pelanggan'));
    void loadProducts().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat produk'));
  }, [token]);

  function supplierName(id?: string | null) {
    if (!id) return '-';
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  function customerName(id?: string | null) {
    if (!id) return '-';
    return customers.find((c) => c.id === id)?.name ?? id;
  }

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  function addDraftItem() {
    if (!draft.productId) return;
    setItems((prev) => [...prev, { ...draft, quantity: draft.quantity || '1', unitPrice: draft.unitPrice || '0' }]);
    setDraft({ productId: '', quantity: '1', unitPrice: '' });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function createConsignment(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/consignments', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          customerId: customerId || undefined,
          number: number.trim() || undefined,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
          })),
        }),
      });
      setSupplierId('');
      setCustomerId('');
      setNumber('');
      setItems([]);
      setDraft({ productId: '', quantity: '1', unitPrice: '' });
      await loadConsignments();
      setMsg('Consignment dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat consignment');
    } finally {
      setBusy(false);
    }
  }

  async function settleConsignment(id: string) {
    if (!canManage) return;
    const amount = settleAmounts[id];
    if (!amount) {
      setMsg('Amount settle wajib diisi.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/consignments/${id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
      });
      setSettleAmounts((prev) => ({ ...prev, [id]: '' }));
      await loadConsignments();
      setMsg('Consignment settled.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal settle consignment');
    } finally {
      setBusy(false);
    }
  }

  const money = (v: number | string) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v));

  return (
    <section className="stack">
      <Panel eyebrow="CONSIGNMENT" title="Consignment Order" badge={`${consignments.length} order`}>
        <p className="sectionHelp">
          Kelola consignment order, supplier/customer, item, dan settlement.
        </p>
        <Table
          head={['Nomor', 'Supplier', 'Customer', 'Status', 'Settle', 'Aksi']}
          rows={consignments.map((c) => [
            <strong key={`${c.id}-number`}>{c.number}</strong>,
            supplierName(c.supplierId),
            customerName(c.customerId),
            <StatusChip key={`${c.id}-status`} status={c.status} />,
            canManage ? (
              <input
                key={`${c.id}-amount`}
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={settleAmounts[c.id] ?? ''}
                onChange={(e) => setSettleAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
              />
            ) : null,
            canManage && c.status !== 'SETTLED' ? (
              <button
                key={`${c.id}-settle`}
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void settleConsignment(c.id)}
              >
                Settle
              </button>
            ) : null,
          ])}
          empty="Belum ada consignment"
        />
      </Panel>

      {canManage && (
        <Panel eyebrow="BUAT CONSIGNMENT" title="Form Create Consignment">
          <form className="formStack" onSubmit={createConsignment}>
            <div className="formGrid">
              <label>
                Supplier
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Pilih supplier</option>
                  {suppliers.filter((s) => s.isActive !== false).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Customer
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Pilih customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nomor (opsional)
                <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="CON-..." />
              </label>
            </div>

            <div className="formGrid">
              <label>
                Produk
                <select
                  value={draft.productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setDraft((prev) => ({ ...prev, productId: e.target.value, unitPrice: p ? String(p.salePrice) : prev.unitPrice }));
                  }}
                >
                  <option value="">Pilih produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah
                <input
                  type="number"
                  min="1"
                  value={draft.quantity}
                  onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label>
                Harga unit
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
              </label>
              <div className="actionRow">
                <button type="button" className="secondary" onClick={addDraftItem}>
                  Tambah item
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="table">
                <div className="tr th">
                  <span>Produk</span>
                  <span>Jumlah</span>
                  <span>Harga</span>
                  <span>Aksi</span>
                </div>
                {items.map((it, idx) => (
                  <div className="tr" key={idx}>
                    <span>{productName(it.productId)}</span>
                    <span>{it.quantity}</span>
                    <span>{money(it.unitPrice)}</span>
                    <span>
                      <button type="button" className="secondary" onClick={() => removeItem(idx)}>
                        Hapus
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="actionRow">
              <button disabled={busy}>Buat consignment</button>
            </div>
          </form>
        </Panel>
      )}

      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}