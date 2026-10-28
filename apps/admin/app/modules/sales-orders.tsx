'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Customer = { id: string; name: string };
type Product = { id: string; name: string; salePrice: number | string };
type SalesOrderItem = {
  id?: string;
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
  subtotal?: number | string;
};
type SalesOrderPayment = {
  id: string;
  amount: number | string;
  method: string;
  createdAt?: string;
};
type SalesOrder = {
  id: string;
  number: string;
  customerId?: string | null;
  subtotal: number | string;
  discount?: number | string;
  tax?: number | string;
  total: number | string;
  dpAmount: number | string;
  settledAmount?: number | string;
  status: string;
  notes?: string | null;
  createdAt?: string;
  items: SalesOrderItem[];
  payments?: SalesOrderPayment[];
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

export default function SalesOrdersView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('sales.manage');

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string; unitPrice: string }[]>([]);
  const [draft, setDraft] = useState({ productId: '', quantity: '1', unitPrice: '' });
  const [dpAmount, setDpAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');

  async function loadOrders() {
    setOrders(await req<SalesOrder[]>(token, '/sales-orders'));
  }

  async function loadCustomers() {
    setCustomers(await req<Customer[]>(token, '/master-data/customers'));
  }

  async function loadProducts() {
    const d = await req<{ items?: Product[] }>(token, '/products?limit=100&includeInactive=true');
    setProducts(d.items ?? []);
  }

  useEffect(() => {
    void loadOrders().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat sales order'));
    void loadCustomers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat pelanggan'));
    void loadProducts().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat produk'));
  }, [token]);

  function customerName(id?: string | null) {
    if (!id) return '-';
    return customers.find((c) => c.id === id)?.name ?? id;
  }

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  function addDraftItem() {
    if (!draft.productId) return;
    setItems((prev) => [...prev, { productId: draft.productId, quantity: draft.quantity || '1', unitPrice: draft.unitPrice || '0' }]);
    setDraft({ productId: '', quantity: '1', unitPrice: '' });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (!items.length) {
      setMsg('Items wajib diisi.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/sales-orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId || undefined,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
          })),
          dpAmount: dpAmount ? Number(dpAmount) : 0,
          notes: notes || undefined,
        }),
      });
      setItems([]);
      setDraft({ productId: '', quantity: '1', unitPrice: '' });
      setDpAmount('');
      setNotes('');
      setSelectedCustomerId('');
      await loadOrders();
      setMsg('Sales order dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat sales order');
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(order: SalesOrder) {
    setBusy(true);
    setMsg('');
    try {
      const d = await req<SalesOrder>(token, `/sales-orders/${order.id}`);
      setSelected(d);
      setSettleAmount('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat detail sales order');
    } finally {
      setBusy(false);
    }
  }

  async function settleOrder(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selected) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/sales-orders/${selected.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(settleAmount) || 0, method: settleMethod }),
      });
      const d = await req<SalesOrder>(token, `/sales-orders/${selected.id}`);
      setSelected(d);
      await loadOrders();
      setMsg('Settlement dicatat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal settle sales order');
    } finally {
      setBusy(false);
    }
  }

  const money = (v: number | string) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v));

  return (
    <section className="stack">
      <Panel eyebrow="SALES ORDER" title="Sales Order / DP" badge={`${orders.length} order`}>
        <p className="sectionHelp">
          Kelola sales order, down payment (DP), dan pelunasan/settlement.
        </p>
        <Table
          head={['Nomor', 'Pelanggan', 'Total', 'DP', 'Status', 'Aksi']}
          rows={orders.map((order) => [
            <strong key={`${order.id}-number`}>{order.number}</strong>,
            customerName(order.customerId),
            money(order.total),
            money(order.dpAmount),
            <StatusChip key={`${order.id}-status`} status={order.status} />,
            <button
              key={`${order.id}-detail`}
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void openDetail(order)}
            >
              Detail
            </button>,
          ])}
          empty="Belum ada sales order"
        />
      </Panel>

      {canManage && (
        <Panel eyebrow="BUAT SALES ORDER" title="Form Create Sales Order">
          <form className="formStack" onSubmit={createOrder}>
            <div className="formGrid">
              <label>
                Pelanggan
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  <option value="">Pilih pelanggan</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                DP Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dpAmount}
                  onChange={(e) => setDpAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                Catatan
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan" />
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
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Qty
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.quantity}
                  onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label>
                Harga satuan
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
              </label>
              <div className="actionRow">
                <button type="button" className="secondary" onClick={addDraftItem} disabled={!draft.productId}>
                  Tambah item
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <Table
                head={['Produk', 'Qty', 'Harga', 'Subtotal', 'Aksi']}
                rows={items.map((it, index) => [
                  productName(it.productId),
                  it.quantity,
                  money(it.unitPrice),
                  money(Number(it.quantity) * Number(it.unitPrice)),
                  <button
                    key={`remove-${index}`}
                    type="button"
                    className="secondary"
                    onClick={() => removeItem(index)}
                  >
                    Hapus
                  </button>,
                ])}
                empty="Belum ada item"
              />
            )}

            <div className="actionRow">
              <button disabled={busy || !items.length}>Buat sales order</button>
            </div>
          </form>
        </Panel>
      )}

      {selected && (
        <Panel eyebrow="DETAIL SALES ORDER" title={selected.number} badge={selected.status}>
          <p className="sectionHelp">
            Pelanggan: {customerName(selected.customerId)} · Total: {money(selected.total)} · DP: {money(selected.dpAmount)} · Settled: {money(selected.settledAmount ?? 0)}
          </p>
          <Table
            head={['Produk', 'Qty', 'Harga', 'Subtotal']}
            rows={(selected.items ?? []).map((it) => [
              productName(it.productId),
              it.quantity,
              money(it.unitPrice),
              money(it.subtotal ?? Number(it.quantity) * Number(it.unitPrice)),
            ])}
            empty="Belum ada item"
          />
          {(selected.payments ?? []).length > 0 && (
            <Table
              head={['Metode', 'Jumlah', 'Waktu']}
              rows={(selected.payments ?? []).map((p) => [
                p.method,
                money(p.amount),
                p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : '-',
              ])}
              empty="Belum ada pembayaran"
            />
          )}

          {canManage && (
            <form className="formStack" onSubmit={settleOrder}>
              <div className="formGrid">
                <label>
                  Jumlah settle
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  Metode
                  <select value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)}>
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK</option>
                    <option value="TRANSFER">TRANSFER</option>
                  </select>
                </label>
              </div>
              <div className="actionRow">
                <button disabled={busy}>Settle</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelected(null)}
                >
                  Tutup
                </button>
              </div>
            </form>
          )}
        </Panel>
      )}

      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}