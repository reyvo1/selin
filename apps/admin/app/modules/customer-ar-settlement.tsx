'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { usePermissions } from '../permissions';
import { Panel, Table, rupiah } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type AgingBucket = { bucket: string; amount: number };
type AgingRow = {
  id: string;
  number: string;
  transactionDate: string;
  counterpartyName: string | null;
  netAmount: string;
  referenceType: string | null;
  referenceId: string | null;
};
type AgingResponse = {
  asOf: string;
  totalOutstanding: string;
  buckets: AgingBucket[];
  transactions: AgingRow[];
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

export default function CustomerARSettlementView({ token }: { token: string }) {
  const { canAll } = usePermissions(token);
  const canView = canAll('finance.view');
  const canPost = canAll('finance.post');
  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [note, setNote] = useState('');
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!canView) return;
    setMsg('');
    try {
      const data = await req<AgingResponse>(token, '/customer-ar-settlement/aging');
      setAging(data);
    } catch (e) {
      setAging(null);
      setMsg(e instanceof Error ? e.message : 'Gagal memuat AR');
    }
  }

  useEffect(() => { void load(); }, [token, canView]);

  const totalOutstanding = useMemo(() => Number(aging?.totalOutstanding ?? 0), [aging]);

  async function settle(invoice: AgingRow) {
    if (!canPost) return;
    const remaining = Number(invoice.netAmount);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setMsg('Nominal pelunasan tidak valid.');
      return;
    }
    // operationKey stabil: per invoice, agar retry pada transaksi yang sama tidak
    // membuat jurnal kedua. Ganti key bila pengguna benar-benar ingin pelunasan baru.
    const operationKey = `ar-${invoice.id}-v1`;
    setBusyInvoiceId(invoice.id);
    setMsg('');
    try {
      await req(token, '/customer-ar-settlement/settle', {
        method: 'POST',
        headers: { 'Idempotency-Key': `ar-settle:${invoice.id}` },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: remaining,
          operationKey,
          note: note.trim() || undefined,
          debitAccountCode: '1010',
        }),
      });
      setBusyInvoiceId(null);
      setNote('');
      setMsg(`Pelunasan ${rupiah(remaining)} pada ${invoice.number} berhasil diposting.`);
      await load();
    } catch (e) {
      setBusyInvoiceId(null);
      setMsg(e instanceof Error ? e.message : 'Gagal melunasi');
    }
  }

  return (
    <section className="stack">
      {msg && <p className="sectionHelp">{msg}</p>}
      <Panel
        eyebrow="CUSTOMER AR SETTLEMENT"
        title="Piutang Pelanggan & Pelunasan"
        badge={aging ? `${aging.transactions.length} transaksi` : '…'}
      >
        {aging && (
          <>
            <div className="metricGrid">
              <div>
                <span className="label">Total Outstanding</span>
                <span className="value">{rupiah(totalOutstanding)}</span>
              </div>
              <div>
                <span className="label">Sebagai dari</span>
                <span className="value">{new Date(aging.asOf).toLocaleString('id-ID')}</span>
              </div>
            </div>
            {aging.buckets.length > 0 && (
              <div className="responsiveFormGrid">
                {aging.buckets.map((b) => (
                  <div key={b.bucket}>
                    <span className="label">{b.bucket}</span>
                    <span className="value">{rupiah(Number(b.amount))}</span>
                  </div>
                ))}
              </div>
            )}
            {canPost && (
              <div className="formStack">
                <label>
                  Catatan pelunasan (opsional)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="mis. Pelunasan penuh invoice"
                  />
                </label>
              </div>
            )}
          </>
        )}
        <Table
          head={['No. Dokumen', 'Customer', 'Jenis', 'Jumlah', 'Tanggal', 'Aksi']}
          rows={(aging?.transactions ?? []).map((inv) => [
            inv.number,
            inv.counterpartyName ?? '—',
            inv.referenceType ?? inv.id.slice(0, 8),
            rupiah(Number(inv.netAmount)),
            inv.transactionDate ? new Date(inv.transactionDate).toLocaleDateString('id-ID') : '—',
            canPost
              ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={busyInvoiceId === inv.id}
                  onClick={() => void settle(inv)}
                >
                  {busyInvoiceId === inv.id ? 'Memproses…' : 'Lunasi'}
                </button>
              )
              : null,
          ])}
          empty={aging ? 'Belum ada transaksi piutang pada branch ini.' : 'Memuat…'}
        />
      </Panel>
    </section>
  );
}
