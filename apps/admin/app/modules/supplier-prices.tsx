'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Supplier = { id: string; name: string; code?: string };
type Product = { id: string; sku?: string; name: string };

type SupplierPrice = {
  id: string;
  supplierId: string;
  productId: string;
  supplierName?: string;
  productName?: string;
  price: string;
  minQty: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
};

type SupplierPriceHistory = {
  id: string;
  supplierId?: string | null;
  productId?: string | null;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: string;
  supplierName?: string;
  productName?: string;
};

type CursorResponse<T> = T[] | { items?: T[] };

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(`${API}${path}`, token, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message ?? 'Request gagal');
  return d as T;
}

function rows<T>(value: CursorResponse<T>): T[] {
  return Array.isArray(value) ? value : (value.items ?? []);
}

export default function SupplierPricesView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('supplier.create') || canAll('supplier.update');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [history, setHistory] = useState<SupplierPriceHistory[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const [formSupplierId, setFormSupplierId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formMinQty, setFormMinQty] = useState('1');
  const [formNotes, setFormNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadSuppliers() {
    const d = await req<CursorResponse<Supplier>>(token, '/suppliers?limit=200&includeInactive=true');
    setSuppliers(rows(d));
  }

  async function loadProducts() {
    const d = await req<CursorResponse<Product>>(token, '/products?limit=200&includeInactive=true');
    setProducts(rows(d));
  }

  async function loadPrices() {
    const q = new URLSearchParams();
    if (filterSupplierId) q.set('supplierId', filterSupplierId);
    if (filterProductId) q.set('productId', filterProductId);
    const d = await req<SupplierPrice[] | { items?: SupplierPrice[] }>(token, `/supplier-prices?${q.toString()}`);
    setPrices(Array.isArray(d) ? d : (d.items ?? []));
  }

  async function loadHistory() {
    const q = new URLSearchParams();
    if (filterSupplierId) q.set('supplierId', filterSupplierId);
    if (filterProductId) q.set('productId', filterProductId);
    const d = await req<SupplierPriceHistory[]>(token, `/supplier-prices/history?${q.toString()}`);
    setHistory(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    void loadSuppliers().catch(() => {});
    void loadProducts().catch(() => {});
    void loadPrices().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat harga supplier'));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createPrice(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (!formSupplierId || !formProductId || !formPrice) {
      setMsg('Supplier, produk, dan harga wajib diisi.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/supplier-prices', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: formSupplierId,
          productId: formProductId,
          price: formPrice,
          minQty: Number(formMinQty) || 1,
          notes: formNotes.trim() || undefined,
        }),
      });
      setFormSupplierId('');
      setFormProductId('');
      setFormPrice('');
      setFormMinQty('1');
      setFormNotes('');
      await loadPrices();
      setMsg('Harga supplier berhasil ditambahkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menambahkan harga supplier');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      {msg && <p className="sectionHelp">{msg}</p>}

      <Panel eyebrow="SUPPLIER PRICES" title="Harga supplier" badge={`${prices.length} baris`}>
        <div className="formStack">
          <div className="grid2">
            <label>Filter supplier<select value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)}><option value="">Semua supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.code ? s.code + ' · ' : ''}{s.name}</option>)}</select></label>
            <label>Filter produk<select value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)}><option value="">Semua produk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? p.sku + ' · ' : ''}{p.name}</option>)}</select></label>
          </div>
          <button type="button" disabled={busy} onClick={() => { setMsg(''); void loadPrices().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat harga')); }}>Muat ulang</button>
        </div>

        {canManage && (
          <details className="formStack">
            <summary>Buat harga supplier baru</summary>
            <form onSubmit={createPrice} className="formStack">
              <div className="grid2">
                <label>Supplier<select value={formSupplierId} onChange={(e) => setFormSupplierId(e.target.value)} required><option value="">Pilih supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.code ? s.code + ' · ' : ''}{s.name}</option>)}</select></label>
                <label>Produk<select value={formProductId} onChange={(e) => setFormProductId(e.target.value)} required><option value="">Pilih produk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? p.sku + ' · ' : ''}{p.name}</option>)}</select></label>
              </div>
              <div className="grid2">
                <label>Harga<input type="number" min="1" step="1" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} required placeholder="Rp" /></label>
                <label>Min qty<input type="number" min="1" value={formMinQty} onChange={(e) => setFormMinQty(e.target.value)} /></label>
              </div>
              <label>Catatan<input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="opsional" /></label>
              <button disabled={busy}>Simpan harga</button>
            </form>
          </details>
        )}

        <Table
          head={['Supplier', 'Produk', 'Harga', 'Min Qty', 'Status', 'Efektif', 'Catatan']}
          rows={prices.map((p) => [
            suppliers.find((s) => s.id === p.supplierId)?.name ?? p.supplierId ?? '-',
            products.find((pr) => pr.id === p.productId)?.name ?? p.productId ?? '-',
            rupiah(p.price),
            p.minQty,
            <StatusChip status={p.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            p.effectiveFrom ? tanggal(p.effectiveFrom) : '-',
            p.notes ?? '-',
          ])}
          empty="Belum ada harga supplier."
        />
      </Panel>

      <Panel eyebrow="PRICE HISTORY" title="Riwayat perubahan harga" badge={`${history.length} entri`}>
        <div className="formStack">
          <button type="button" disabled={busy} onClick={() => { setShowHistory((v) => !v); if (!showHistory) void loadHistory().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat history')); }}>
            {showHistory ? 'Sembunyikan' : 'Tampilkan riwayat'}
          </button>
        </div>
        {showHistory && history.length > 0 && (
          <Table
            head={['Supplier', 'Produk', 'Field', 'Old Value', 'New Value', 'Waktu']}
            rows={history.map((h) => [
              suppliers.find((s) => s.id === h.supplierId)?.name ?? h.supplierId ?? '-',
              products.find((p) => p.id === h.productId)?.name ?? h.productId ?? '-',
              h.field,
              h.oldValue ? rupiah(h.oldValue) : '-',
              h.newValue ? rupiah(h.newValue) : '-',
              tanggal(h.changedAt),
            ])}
            empty="Tidak ada riwayat."
          />
        )}
        {showHistory && history.length === 0 && <p className="sectionHelp">Tidak ada data riwayat untuk filter saat ini.</p>}
      </Panel>
    </section>
  );
}
