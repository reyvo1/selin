'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type GeneralSetting = { id: string; namespace: string; key: string; value: unknown; isSecret: boolean; branchId?: string | null; updatedAt?: string };

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(`${API}${path}`, token, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message ?? 'Request gagal');
  return d as T;
}

export default function GeneralSettingsView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canManage = canAll('platform.configure');
  const [settings, setSettings] = useState<GeneralSetting[]>([]);
  const [form, setForm] = useState({ namespace: 'general', key: 'timezone', value: 'Asia/Makassar', isSecret: false });
  const [msg, setMsg] = useState('');

  async function load() {
    setSettings(await req<GeneralSetting[]>(token, '/platform/settings?namespace=general'));
  }

  useEffect(() => { void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Gagal memuat pengaturan umum')); }, [token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    try {
      await req(token, '/platform/settings', { method: 'POST', body: JSON.stringify({ namespace: form.namespace, key: form.key, value: form.value, isSecret: form.isSecret }) });
      setForm({ ...form, key: '', value: '{}' });
      await load();
      setMsg('Pengaturan umum disimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan umum');
    }
  }

  async function saveGeneral(key: string, value: unknown) {
    if (!canManage) return;
    try {
      await req(token, '/general-settings', { method: 'POST', body: JSON.stringify({ namespace: 'general', key, value }) });
      await load();
      setMsg('Pengaturan umum disimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan umum');
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="PENGATURAN UMUM" title="Pengaturan Umum" badge={`${settings.length} setting`}>
        <p className="sectionHelp">Konfigurasi umum aplikasi: timezone, locale, currency, format tanggal, dan format angka per company.</p>
        <form className="formStack" onSubmit={save}>
          <div className="grid2">
            <label>Namespace<input required value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} /></label>
            <label>Key<input required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="timezone / locale / currency" /></label>
          </div>
          <label>Value<input required value={typeof form.value === 'string' ? form.value : JSON.stringify(form.value)} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
          <button disabled={!canManage}>Simpan pengaturan umum</button>
        </form>
      </Panel>
      <Panel eyebrow="SETTING AKTIF" title="Pengaturan Umum Aktif">
        <Table head={['Namespace', 'Key', 'Value', 'Scope']} rows={settings.map((row) => [row.namespace, <strong>{row.key}</strong>, <code>{typeof row.value === 'string' ? row.value : JSON.stringify(row.value)}</code>, row.branchId ? 'BRANCH' : 'COMPANY'])} empty="Belum ada pengaturan umum." />
      </Panel>
      <div className="actionRow">
        <button type="button" className="secondary" onClick={() => void saveGeneral('timezone', 'Asia/Makassar')}>Set timezone</button>
        <button type="button" className="secondary" onClick={() => void saveGeneral('locale', 'id-ID')}>Set locale</button>
      </div>
      {msg && <div className="notice">{msg}</div>}
    </section>
  );
}
