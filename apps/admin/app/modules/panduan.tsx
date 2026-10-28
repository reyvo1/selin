'use client';

import { useState } from 'react';
import { Panel } from '../ui';

const GUIDE_SECTIONS = [
  {
    title: 'Mulai cepat',
    body: [
      'Masuk dengan akun yang memiliki akses admin, lalu pilih company/branch aktif di header.',
      'Gunakan menu kiri untuk berpindah workspace; gunakan pencarian menu untuk menemukan fitur dengan cepat.',
      'Pastikan Setup Readiness pada Pengaturan menunjukkan status lengkap sebelum transaksi produksi.',
    ],
  },
  {
    title: 'Navigasi utama',
    body: [
      'Ringkasan: Dashboard dan metrik operasional.',
      'Operasional: Penjualan & Order, Pembelian, Produksi, Persediaan, Kontrol Operasional, Produk & Master Data.',
      'Keuangan & SDM: Keuangan, Laporan & Analitik, HRIS & Payroll, Aset & Armada.',
      'Intelligence: Forecast & Otomasi.',
      'Platform: Integrasi & Notifikasi, Tenant & Organisasi, Pengaturan & Akses.',
    ],
  },
  {
    title: 'Alur kerja umum',
    body: [
      'Master data: buat produk, customer, supplier, dan referensi sebelum transaksi.',
      'Pembelian: purchase request -> purchase order -> penerimaan barang -> jurnal otomatis.',
      'Penjualan: order -> fulfillment -> pembayaran -> retur bila diperlukan.',
      'Persediaan: pantau saldo, transfer, stock opname, dan traceability batch/serial.',
      'Keuangan: jurnal, pajak, fiscal period, AP/AR, kas & bank, dan laporan.',
    ],
  },
  {
    title: 'Tips operator',
    body: [
      'Gunakan filter periode/cabang/gudang pada laporan sebelum export.',
      'Periksa Audit & Ops untuk melihat event outbox dan dead letter.',
      'Gunakan Info Program untuk melihat versi, build, dan identitas deployment.',
      'Simpan perubahan konfigurasi runtime melalui Pengaturan agar teraudit.',
    ],
  },
  {
    title: 'Bantuan lanjutan',
    body: [
      'Dokumentasi teknis tersedia di repository: README.md, docs/EXTENSION-GUIDE.md, dan docs/IPOS-5-PARITY-WORKFLOW.md.',
      'Bila menemui error, catat pesan, waktu, dan langkah reproduksi lalu hubungi administrator sistem.',
    ],
  },
];

export default function PanduanView({ token }: { token: string }) {
  const [active, setActive] = useState(0);
  const section = GUIDE_SECTIONS[active];

  return (
    <section className="stack">
      <Panel eyebrow="PANDUAN" title="Panduan penggunaan Toko360" badge="In-app guide">
        <p className="sectionHelp">
          Panduan operasional singkat untuk admin. Pilih topik di bawah untuk melihat langkah dan tips penggunaan.
        </p>
        <div className="actionRow">
          {GUIDE_SECTIONS.map((item, index) => (
            <button
              key={item.title}
              type="button"
              className={index === active ? '' : 'secondary'}
              onClick={() => setActive(index)}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="grid2">
          <div>
            <strong>{section.title}</strong>
            <ul>
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Referensi cepat</strong>
            <p className="sectionHelp">Gunakan menu Pengaturan &gt; Info Program untuk detail versi dan build.</p>
            <p className="sectionHelp">Gunakan Laporan &amp; Analitik untuk export data operasional.</p>
            <p className="sectionHelp">Token aktif: {token ? 'tersedia' : 'tidak tersedia'}.</p>
          </div>
        </div>
      </Panel>
    </section>
  );
}
