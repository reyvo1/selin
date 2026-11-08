'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { readOptional } from '../read-path-contract';
import { Panel, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type WarehouseRef = { id: string; code?: string; name: string };
type Location = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  warehouseId: string;
  warehouse?: WarehouseRef;
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

export default function WarehouseLocationsView({ token }: { token: string }) {
  const { canAll, identity } = usePermissions(token);
  const canManage = canAll('inventory.manage');
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [locs, whs] = await Promise.all([
      req<Location[]>(token, '/warehouse-locations'),
      readOptional<WarehouseRef[]>(identity, '/master-data/warehouses', [], (p) => req(token, p)),
    ]);
    setLocations(Array.isArray(locs) ? locs : []);
    setWarehouses(Array.isArray(whs) ? whs : []);
  }

  useEffect(() => { void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat lokasi')); }, [token]);

  async function createLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !formCode || !formWarehouseId) return;
    setBusy(true);
    setMsg('');
    try {
      await req(token, '/warehouse-locations', {
        method: 'POST',
        body: JSON.stringify({ warehouseId: formWarehouseId, code: formCode, name: formName || formCode }),
      });
      setFormCode('');
      setFormName('');
      setFormWarehouseId('');
      await load();
      setMsg('Lokasi gudang berhasil ditambahkan.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal menambahkan lokasi');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    if (!canManage) return;
    await req(token, `/warehouse-locations/${id}/deactivate`, { method: 'POST' });
    await load();
  }

  return (
    <section className="stack">
      {msg && <p className="sectionHelp">{msg}</p>}
      <Panel eyebrow="WAREHOUSE LOCATIONS" title="Lokasi Gudang (Rak/Bin)" badge={`${locations.length} lokasi`}>
        {canManage && (
          <form className="formStack" onSubmit={createLocation}>
            <div className="grid2">
              <label>Gudang<select value={formWarehouseId} onChange={(e) => setFormWarehouseId(e.target.value)} required>
                <option value="">Pilih gudang</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? w.code + ' · ' : ''}{w.name}</option>)}
              </select></label>
              <label>Kode lokasi<input value={formCode} onChange={(e) => setFormCode(e.target.value)} required placeholder="RAK-A01" /></label>
            </div>
            <label>Nama lokasi<input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Opsional" /></label>
            <button disabled={busy}>Tambah lokasi</button>
          </form>
        )}
        <Table
          head={['Gudang', 'Kode', 'Nama', 'Status', 'Aksi']}
          rows={locations.map((loc) => [
            loc.warehouse?.name ?? loc.warehouseId,
            loc.code,
            loc.name ?? '-',
            loc.isActive ? 'Aktif' : 'Nonaktif',
            canManage && loc.isActive ? <button type="button" className="secondary" onClick={() => void deactivate(loc.id)}>Nonaktifkan</button> : null,
          ])}
          empty="Belum ada lokasi gudang."
        />
      </Panel>
    </section>
  );
}
