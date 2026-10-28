'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Product = { id: string; name: string; salePrice: number | string };
type Warehouse = { id: string; name: string; isDefault?: boolean };
type TradeIn = {
  id: string;
  originalProductId: string;
  newProductId?: string | null;
  tradeValue: number | string;
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

export default function TradeInsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('sales.manage');

  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [originalProductId, setOriginalProductId] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [tradeValue, setTradeValue] = useState<number | string>('');
  const [status, setStatus] = useState('DRAFT');
  const [warehouseId, setWarehouseId] = useState('');

  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadTradeIns() {
    setTradeIns(await req<TradeIn[]>(token, '/trade-ins'));
  }

  async function loadProducts() {
    const d = await req<{ items?: Product[] }>(token, '/products?limit=200&includeInactive=true');
    setProducts(d.items ?? []);
  }

  async function loadWarehouses() {
    const d = await req<Warehouse[]>(token, '/master-data/warehouses');
    setWarehouses(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    void loadTradeIns().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat trade-in'));
    void loadProducts().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat produk'));
    void loadWarehouses().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat gudang'));
  }, [token]);

  function productName(id?: string | null) {
    if (!id) return '-';
    return products.find((p) => p.id === id)?.name ?? id;
  }

  async function completeTradeIn(tradeIn: TradeIn) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/trade-ins/${tradeIn.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: warehouseId || undefined, quantity: 1 }),
      });
      await loadTradeIns();
      setMsg('Trade-in diselesaikan (stok & jurnal).');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyelesaikan trade-in');
    } finally {
      setBusy(false);
    }
  }

  async function createTradeIn(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !originalProductId) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/trade-ins', {
        method: 'POST',
        body: JSON.stringify({
          originalProductId,
          newProductId: newProductId || undefined,
          tradeValue: Number(tradeValue) || 0,
          status,
        }),
      });
      setOriginalProductId('');
      setNewProductId('');
      setTradeValue('');
      setStatus('DRAFT');
      await loadTradeIns();
      setMsg('Trade-in dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat trade-in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="TRADE-IN" title="Tukar Tambah" badge={`${tradeIns.length} trade-in`}>
        <p className="sectionHelp">
          Daftar dan pembuatan trade-in (tukar tambah) produk. Foundation: nilai tukar, produk asli, dan produk baru.
        </p>
        {canManage && (
          <form className="formGrid" onSubmit={createTradeIn}>
            <label>
              Produk asli
              <select value={originalProductId} onChange={(e) => setOriginalProductId(e.target.value)} required>
                <option value="">Pilih produk</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Produk baru
              <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                <option value="">(opsional)</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nilai tukar
              <input
                type="number"
                min="0"
                step="0.01"
                value={tradeValue}
                onChange={(e) => setTradeValue(e.target.value)}
                required
              />
            </label>
            <label>
              Status
              <input value={status} onChange={(e) => setStatus(e.target.value)} />
            </label>
            <label>
              Gudang penyelesaian
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">(default)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <div className="formActions">
              <button type="submit" disabled={busy || !originalProductId}>
                {busy ? 'Menyimpan...' : 'Buat trade-in'}
              </button>
            </div>
          </form>
        )}
        {msg && <p className="sectionHelp">{msg}</p>}
        <Table
          head={['Produk asli', 'Produk baru', 'Nilai tukar', 'Status', 'Dibuat', 'Aksi']}
          rows={tradeIns.map((tradeIn) => [
            productName(tradeIn.originalProductId),
            productName(tradeIn.newProductId),
            tradeIn.tradeValue,
            <StatusChip key={tradeIn.id} status={tradeIn.status} />,
            tradeIn.createdAt ? new Date(tradeIn.createdAt).toLocaleString() : '-',
            tradeIn.status === 'DRAFT' && canManage ? (
              <button key={`c-${tradeIn.id}`} type="button" disabled={busy} onClick={() => void completeTradeIn(tradeIn)}>
                Selesaikan
              </button>
            ) : (
              '-'
            ),
          ])}
        />
      </Panel>
    </section>
  );
}
