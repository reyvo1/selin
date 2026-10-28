'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, StatusChip, Table, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type CostingPolicy = {
  id: string;
  method: string;
  mode: string;
  status: string;
  version: number;
  effectiveFrom: string;
  branchId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
};

type Warehouse = { id: string; code?: string; name: string };
type Product = { id: string; sku?: string; name: string };

type PolicyListResponse = { items?: CostingPolicy[]; nextCursor?: string | null };

type ValuationRow = {
  warehouseId: string;
  code?: string | null;
  name?: string | null;
  quantity: number;
  value: string;
};
type ValuationResponse = {
  asOf: string;
  method: string;
  totals: { quantity: number; value: string };
  byWarehouse: ValuationRow[];
};

type CostLayer = {
  id: string;
  warehouseId: string;
  productId: string;
  method: string;
  status: string;
  quantity?: number;
  remainingQty?: number;
  unitCost: string;
  originalValue: string;
  remainingValue: string;
  receivedAt?: string;
  batchKey?: string | null;
};
type LayersResponse = { method?: string; items?: CostLayer[]; nextCursor?: string | null };

type ReconciliationRow = {
  warehouseId: string;
  code?: string | null;
  name?: string | null;
  stateQuantity: number;
  stateValue: string;
  inventoryQuantity: number;
  quantityDifference: number;
  layerRemainingQuantity?: number;
  layerRemainingValue: string;
  layerApplicable: boolean;
  valueDifference?: string | null;
  matched: boolean;
};
type ReconciliationResponse = {
  asOf: string;
  method: string;
  totals?: {
    stateQuantity: number;
    inventoryQuantity: number;
    quantityDifference: number;
    stateValue: string;
    layerRemainingValue: string;
    layerApplicable: boolean;
    matched: boolean;
  };
  gl?: {
    accountCode: string;
    accountId?: string | null;
    accountName?: string | null;
    debit: string;
    credit: string;
    balance: string;
    comparable: boolean;
    matched?: boolean | null;
  };
  byWarehouse?: ReconciliationRow[];
};

type RebuildRun = {
  id: string;
  status: string;
  method: string;
  mode?: string;
  warehouseId?: string | null;
  fromDate: string;
  toDate?: string;
  operationKey: string;
  approvedBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  statistics?: Record<string, unknown> | null;
  createdAt?: string;
};
type RebuildRunsResponse = { items?: RebuildRun[]; nextCursor?: string | null };

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(`${API}${path}`, token, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message ?? 'Request gagal');
  return d as T;
}

export default function InventoryCostingView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canView = canAll('inventory.costing.view');
  const canManage = canAll('inventory.costing.manage');
  const canRebuild = canAll('inventory.costing.rebuild');

  const [policies, setPolicies] = useState<CostingPolicy[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [policyMethod, setPolicyMethod] = useState<'MOVING_AVERAGE' | 'FIFO' | 'LIFO'>('MOVING_AVERAGE');
  const [policyMode, setPolicyMode] = useState<'SHADOW' | 'ACTIVE'>('SHADOW');
  const [policyEffectiveFrom, setPolicyEffectiveFrom] = useState('');
  const [policyCursor, setPolicyCursor] = useState<string | null>(null);

  const [valuationWarehouseId, setValuationWarehouseId] = useState('');
  const [valuationProductId, setValuationProductId] = useState('');
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);

  const [layerWarehouseId, setLayerWarehouseId] = useState('');
  const [layerProductId, setLayerProductId] = useState('');
  const [layerStatus, setLayerStatus] = useState('OPEN');
  const [layerCursor, setLayerCursor] = useState<string | null>(null);
  const [layers, setLayers] = useState<CostLayer[]>([]);
  const [layerMethod, setLayerMethod] = useState('');

  const [reconWarehouseId, setReconWarehouseId] = useState('');
  const [reconProductId, setReconProductId] = useState('');
  const [reconOnlyDifferences, setReconOnlyDifferences] = useState(false);
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);

  const [rebuildWarehouseId, setRebuildWarehouseId] = useState('');
  const [rebuildCutoverAt, setRebuildCutoverAt] = useState('');
  const [rebuildOperationKey, setRebuildOperationKey] = useState('');
  const [rebuildRuns, setRebuildRuns] = useState<RebuildRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRun, setSelectedRun] = useState<RebuildRun | null>(null);

  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadPolicies(cursor?: string | null) {
    const q = new URLSearchParams();
    q.set('limit', '100');
    if (cursor) q.set('cursor', cursor);
    const d = await req<PolicyListResponse>(token, `/inventory/costing/policies?${q.toString()}`);
    setPolicies(d.items ?? []);
    setPolicyCursor(d.nextCursor ?? null);
  }

  async function loadWarehouses() {
    const d = await req<Warehouse[] | { items?: Warehouse[] }>(token, '/master-data/warehouses');
    setWarehouses(Array.isArray(d) ? d : (d.items ?? []));
  }

  async function loadProducts() {
    const d = await req<{ items?: Product[] }>(token, '/products?limit=200&includeInactive=true');
    setProducts(d.items ?? []);
  }

  async function loadValuation() {
    const q = new URLSearchParams();
    if (valuationWarehouseId) q.set('warehouseId', valuationWarehouseId);
    if (valuationProductId) q.set('productId', valuationProductId);
    const d = await req<ValuationResponse>(token, `/inventory/costing/valuation?${q.toString()}`);
    setValuation(d);
  }

  async function loadLayers(cursor?: string | null) {
    const q = new URLSearchParams();
    if (layerWarehouseId) q.set('warehouseId', layerWarehouseId);
    if (layerProductId) q.set('productId', layerProductId);
    if (layerStatus) q.set('status', layerStatus);
    q.set('limit', '100');
    if (cursor) q.set('cursor', cursor);
    const d = await req<LayersResponse>(token, `/inventory/costing/layers?${q.toString()}`);
    setLayers(d.items ?? []);
    setLayerMethod(d.method ?? '');
    setLayerCursor(d.nextCursor ?? null);
  }

  async function loadReconciliation() {
    const q = new URLSearchParams();
    if (reconWarehouseId) q.set('warehouseId', reconWarehouseId);
    if (reconProductId) q.set('productId', reconProductId);
    if (reconOnlyDifferences) q.set('onlyDifferences', 'true');
    q.set('limit', '100');
    const d = await req<ReconciliationResponse>(token, `/inventory/costing/reconciliation?${q.toString()}`);
    setReconciliation(d);
  }

  async function loadRebuildRuns() {
    const d = await req<RebuildRunsResponse>(token, '/inventory/costing/rebuild-runs?limit=100');
    setRebuildRuns(d.items ?? []);
  }

  async function loadRebuildRun(id: string) {
    if (!id) return;
    const d = await req<RebuildRun>(token, `/inventory/costing/rebuild-runs/${id}`);
    setSelectedRun(d);
  }

  useEffect(() => {
    void loadPolicies().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat policy costing'));
    void loadWarehouses().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat gudang'));
    void loadProducts().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat produk'));
    void loadValuation().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat valuasi'));
    void loadLayers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat layer costing'));
    void loadReconciliation().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat rekonsiliasi costing'));
    void loadRebuildRuns().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat rebuild run'));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createPolicy(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (!policyEffectiveFrom) {
      setMsg('effectiveFrom wajib diisi.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/inventory/costing/policies', {
        method: 'POST',
        body: JSON.stringify({
          method: policyMethod,
          mode: policyMode,
          effectiveFrom: new Date(policyEffectiveFrom).toISOString(),
        }),
      });
      setPolicyEffectiveFrom('');
      await loadPolicies();
      setMsg('Policy costing dibuat.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal membuat policy costing');
    } finally {
      setBusy(false);
    }
  }

  async function activatePolicy(id: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/inventory/costing/policies/${id}/activate`, { method: 'POST' });
      await loadPolicies();
      setMsg('Policy costing diaktifkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengaktifkan policy costing');
    } finally {
      setBusy(false);
    }
  }

  async function requestRebuild(e: FormEvent) {
    e.preventDefault();
    if (!canRebuild) return;
    if (!rebuildCutoverAt || !rebuildOperationKey.trim()) {
      setMsg('cutoverAt dan operationKey wajib diisi.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/inventory/costing/rebuild', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: rebuildWarehouseId || undefined,
          cutoverAt: new Date(rebuildCutoverAt).toISOString(),
          operationKey: rebuildOperationKey.trim(),
        }),
      });
      setRebuildCutoverAt('');
      setRebuildOperationKey('');
      await loadRebuildRuns();
      setMsg('Rebuild costing diminta.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal meminta rebuild costing');
    } finally {
      setBusy(false);
    }
  }

  async function approveRebuild(id: string) {
    if (!canRebuild) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/inventory/costing/rebuild-runs/${id}/approve`, { method: 'POST' });
      await loadRebuildRuns();
      await loadRebuildRun(id);
      setMsg('Rebuild costing disetujui/dijalankan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyetujui rebuild costing');
    } finally {
      setBusy(false);
    }
  }

  async function resumeRebuild(id: string) {
    if (!canRebuild) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, `/inventory/costing/rebuild-runs/${id}/resume`, { method: 'POST' });
      await loadRebuildRuns();
      await loadRebuildRun(id);
      setMsg('Rebuild costing dilanjutkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal melanjutkan rebuild costing');
    } finally {
      setBusy(false);
    }
  }

  function warehouseName(id?: string | null) {
    if (!id) return '-';
    return warehouses.find((w) => w.id === id)?.name ?? id;
  }

  function productName(id?: string | null) {
    if (!id) return '-';
    const p = products.find((x) => x.id === id);
    return p ? `${p.sku ? p.sku + ' · ' : ''}${p.name}` : id;
  }

  // Reference canView to avoid unused-variable lint in strict builds.
  void canView;

  return (
    <section className="stack">
      {msg && <p className="sectionHelp">{msg}</p>}

      <Panel eyebrow="COSTING POLICY" title="Kebijakan costing persediaan" badge={`${policies.length} policy`}>
        {canManage && (
          <form className="formStack" onSubmit={createPolicy}>
            <div className="grid2">
              <label>Metode<select value={policyMethod} onChange={(e) => setPolicyMethod(e.target.value as 'MOVING_AVERAGE' | 'FIFO' | 'LIFO')}><option value="MOVING_AVERAGE">MOVING_AVERAGE</option><option value="FIFO">FIFO</option><option value="LIFO">LIFO</option></select></label>
              <label>Mode<select value={policyMode} onChange={(e) => setPolicyMode(e.target.value as 'SHADOW' | 'ACTIVE')}><option value="SHADOW">SHADOW</option><option value="ACTIVE">ACTIVE</option></select></label>
            </div>
            <label>Tanggal efektif<input type="datetime-local" value={policyEffectiveFrom} onChange={(e) => setPolicyEffectiveFrom(e.target.value)} required /></label>
            <button disabled={busy}>Buat policy costing</button>
          </form>
        )}
        <Table
          head={['Metode', 'Mode', 'Status', 'Versi', 'Efektif', 'Aksi']}
          rows={policies.map((p) => [
            p.method,
            p.mode,
            <StatusChip status={p.status} />,
            p.version,
            p.effectiveFrom ? tanggal(p.effectiveFrom) : '-',
            canManage && p.status === 'DRAFT' ? (
              <button type="button" className="secondary" disabled={busy} onClick={() => void activatePolicy(p.id)}>Aktifkan</button>
            ) : null,
          ])}
          empty="Belum ada policy costing."
        />
        {policyCursor && (
          <button type="button" className="secondary" onClick={() => void loadPolicies(policyCursor)}>Muat berikutnya</button>
        )}
      </Panel>

      <Panel eyebrow="VALUATION" title="Valuasi persediaan costing" badge={valuation ? rupiah(valuation.totals.value) : undefined}>
        <div className="formStack">
          <div className="grid2">
            <label>Gudang<select value={valuationWarehouseId} onChange={(e) => setValuationWarehouseId(e.target.value)}><option value="">Semua gudang</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' · ' : ''}{w.name}</option>)}</select></label>
            <label>Produk<select value={valuationProductId} onChange={(e) => setValuationProductId(e.target.value)}><option value="">Semua produk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? p.sku + ' · ' : ''}{p.name}</option>)}</select></label>
          </div>
          <button type="button" disabled={busy} onClick={() => void loadValuation().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat valuasi'))}>Muat valuasi</button>
        </div>
        {valuation && (
          <>
            <p className="sectionHelp">Metode: {valuation.method} · As of {tanggal(valuation.asOf)} · Total qty {valuation.totals.quantity} · Nilai {rupiah(valuation.totals.value)}</p>
            <Table
              head={['Gudang', 'Qty', 'Nilai']}
              rows={valuation.byWarehouse.map((r) => [`${r.code ? r.code + ' · ' : ''}${r.name ?? r.warehouseId}`, r.quantity, rupiah(r.value)])}
              empty="Tidak ada data valuasi."
            />
          </>
        )}
      </Panel>

      <Panel eyebrow="LAYER EXPLORER" title="Eksplorasi cost layer" badge={`${layers.length} layer`}>
        <div className="formStack">
          <div className="grid2">
            <label>Gudang<select value={layerWarehouseId} onChange={(e) => setLayerWarehouseId(e.target.value)}><option value="">Semua gudang</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' · ' : ''}{w.name}</option>)}</select></label>
            <label>Produk<select value={layerProductId} onChange={(e) => setLayerProductId(e.target.value)}><option value="">Semua produk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? p.sku + ' · ' : ''}{p.name}</option>)}</select></label>
          </div>
          <div className="grid2">
            <label>Status<select value={layerStatus} onChange={(e) => setLayerStatus(e.target.value)}><option value="OPEN">OPEN</option><option value="CONSUMED">CONSUMED</option><option value="REVERSED">REVERSED</option></select></label>
            <button type="button" disabled={busy} onClick={() => void loadLayers().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat layer'))}>Muat layer</button>
          </div>
        </div>
        {layerMethod && <p className="sectionHelp">Metode aktif: {layerMethod}</p>}
        <Table
          head={['Gudang', 'Produk', 'Status', 'Qty awal', 'Sisa qty', 'Unit cost', 'Nilai sisa', 'Diterima']}
          rows={layers.map((l) => [
            warehouseName(l.warehouseId),
            productName(l.productId),
            <StatusChip status={l.status} />,
            l.quantity ?? '-',
            l.remainingQty ?? '-',
            l.unitCost,
            rupiah(l.remainingValue),
            l.receivedAt ? tanggal(l.receivedAt) : '-',
          ])}
          empty="Belum ada cost layer."
        />
        {layerCursor && (
          <button type="button" className="secondary" onClick={() => void loadLayers(layerCursor).catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat layer'))}>Muat berikutnya</button>
        )}
      </Panel>

      <Panel eyebrow="RECONCILIATION" title="Rekonsiliasi costing vs stok/GL" badge={reconciliation ? (reconciliation.totals?.matched ? 'MATCHED' : 'DIFF') : undefined}>
        <div className="formStack">
          <div className="grid2">
            <label>Gudang<select value={reconWarehouseId} onChange={(e) => setReconWarehouseId(e.target.value)}><option value="">Semua gudang</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' · ' : ''}{w.name}</option>)}</select></label>
            <label>Produk<select value={reconProductId} onChange={(e) => setReconProductId(e.target.value)}><option value="">Semua produk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? p.sku + ' · ' : ''}{p.name}</option>)}</select></label>
          </div>
          <label className="checkboxRow"><input type="checkbox" checked={reconOnlyDifferences} onChange={(e) => setReconOnlyDifferences(e.target.checked)} /> Hanya selisih</label>
          <button type="button" disabled={busy} onClick={() => void loadReconciliation().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat rekonsiliasi'))}>Muat rekonsiliasi</button>
        </div>
        {reconciliation && (
          <>
            <p className="sectionHelp">Metode: {reconciliation.method} · State qty {reconciliation.totals?.stateQuantity ?? 0} · Inventory qty {reconciliation.totals?.inventoryQuantity ?? 0} · Selisih {reconciliation.totals?.quantityDifference ?? 0}</p>
            {reconciliation.gl && (
              <p className="sectionHelp">GL 1301: debit {rupiah(reconciliation.gl.debit)} · credit {rupiah(reconciliation.gl.credit)} · saldo {rupiah(reconciliation.gl.balance)} · {reconciliation.gl.matched === null ? 'n/a' : reconciliation.gl.matched ? 'MATCHED' : 'DIFF'}</p>
            )}
            <Table
              head={['Gudang', 'State qty', 'State nilai', 'Inventory qty', 'Selisih qty', 'Layer sisa', 'Matched']}
              rows={(reconciliation.byWarehouse ?? []).map((r) => [
                `${r.code ? r.code + ' · ' : ''}${r.name ?? r.warehouseId}`,
                r.stateQuantity,
                rupiah(r.stateValue),
                r.inventoryQuantity,
                r.quantityDifference,
                rupiah(r.layerRemainingValue),
                r.matched ? 'MATCHED' : 'DIFF',
              ])}
              empty="Tidak ada data rekonsiliasi."
            />
          </>
        )}
      </Panel>

      <Panel eyebrow="REBUILD" title="Rebuild costing / backfill snapshot" badge={`${rebuildRuns.length} run`}>
        {canRebuild && (
          <form className="formStack" onSubmit={requestRebuild}>
            <div className="grid2">
              <label>Gudang<select value={rebuildWarehouseId} onChange={(e) => setRebuildWarehouseId(e.target.value)}><option value="">Semua gudang</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' · ' : ''}{w.name}</option>)}</select></label>
              <label>Cutover<input type="datetime-local" value={rebuildCutoverAt} onChange={(e) => setRebuildCutoverAt(e.target.value)} required /></label>
            </div>
            <label>Operation key<input value={rebuildOperationKey} onChange={(e) => setRebuildOperationKey(e.target.value)} minLength={8} required placeholder="minimal 8 karakter" /></label>
            <button disabled={busy}>Minta rebuild</button>
          </form>
        )}
        <Table
          head={['Status', 'Metode', 'Gudang', 'Operation key', 'Dibuat', 'Aksi']}
          rows={rebuildRuns.map((r) => [
            <StatusChip status={r.status} />,
            r.method,
            r.warehouseId ? warehouseName(r.warehouseId) : 'Semua',
            r.operationKey,
            r.createdAt ? tanggal(r.createdAt) : '-',
            <div className="rowActions">
              <button type="button" className="secondary" onClick={() => { setSelectedRunId(r.id); void loadRebuildRun(r.id).catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat run')); }}>Detail</button>
              {canRebuild && r.status === 'PENDING' && <button type="button" onClick={() => void approveRebuild(r.id)}>Approve</button>}
              {canRebuild && (r.status === 'FAILED' || r.status === 'PENDING') && <button type="button" className="secondary" onClick={() => void resumeRebuild(r.id)}>Resume</button>}
            </div>,
          ])}
          empty="Belum ada rebuild run."
        />
        {selectedRunId && selectedRun && (
          <div className="formStack">
            <h3>Detail rebuild run</h3>
            <p className="sectionHelp">ID: {selectedRun.id} · Status: {selectedRun.status} · Metode: {selectedRun.method}</p>
            <p className="sectionHelp">Cutover: {selectedRun.fromDate ? tanggal(selectedRun.fromDate) : '-'} · Selesai: {selectedRun.finishedAt ? tanggal(selectedRun.finishedAt) : '-'}</p>
            {selectedRun.statistics && <pre className="sectionHelp">{JSON.stringify(selectedRun.statistics, null, 2)}</pre>}
          </div>
        )}
      </Panel>
    </section>
  );
}

export const InventoryCosting = InventoryCostingView;
