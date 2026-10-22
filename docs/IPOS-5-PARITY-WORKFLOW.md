# Workflow Paritas IPOS 5.0 di Toko360

> **Status dokumen:** PLANNING / BASELINE DISETUJUI UNTUK P0, 21 Oktober 2026.
>
> **Bukan otoritas completion.** Otoritas status produk tetap
> `config/product-completeness.json`. Dokumen ini adalah baseline gap dan urutan
> kerja untuk fitur IPOS yang belum ada atau baru sebagian ada. Status `ADA` di
> sini berarti source/model/API/UI ditemukan, bukan berarti runtime, UAT, atau
> Human Stage-20 sudah lulus.
>
> **Baseline repo:** `main` `c50a047`, 70 work item completed, 0 work item aktif
> sebelum dokumen ini dibuat. Audit ini tidak mengubah kode aplikasi, schema,
> database, atau status P5. `productReady=false`, `currentPhase=P5`,
> `humanStage20=PENDING` tetap berlaku.
>
> **Gerbang persetujuan:** checklist, status, asumsi, dan prioritas disetujui
> user pada 21 Oktober 2026. Keputusan desain terinci (metode HPP, BIAYA,
> konsinyasi, cek/BG, customer display, dan migrasi) tetap wajib dijawab sebelum
> DESIGN paket terkait ditutup. Jangan mulai IMPLEMENTATION sebelum DESIGN dan
> migration plan disetujui.

## 1. Tujuan dan posisi dokumen

Dokumen ini menjawab tiga pertanyaan:

1. Dari checklist IPOS yang dikirim user, mana yang sudah ada, baru sebagian,
   dan belum ada di Toko360?
2. Bukti apa yang mendasari setiap status, dan bagian mana yang belum bisa
   dinyatakan benar karena audit ini hanya source-level?
3. Dalam urutan apa fitur yang kurang dikerjakan agar tidak merusak stok,
   HPP, jurnal, pajak, piutang/utang, sinkronisasi, dan data produksi?

Dokumen ini **bukan**:

- daftar work item yang sudah dibuat;
- izin untuk menulis kode sebelum fase INTAKE/ANALYSIS/DESIGN masing-masing
  paket selesai;
- pengganti `docs/DEVELOPMENT-WORKFLOW.md`, `docs/DEVELOPMENT-KIT.md`, atau
  `config/product-completeness.json`;
- klaim bahwa fitur `ADA` sudah layak produksi.

## 2. Sumber, metode, dan definisi status

### 2.1 Sumber

- Checklist fitur IPOS dari pesan user. Tidak ada file sumber IPOS di repo ini
  atau di `/home/ivo/Desktop`; pencarian `ipos` hanya menemukan false positive
  kata "mempunyai". Karena itu checklist direkonstruksi eksplisit di Bagian 4
  agar bisa dikoreksi user.
- Schema Prisma tiga dialek, controller, service, DTO, test, UI Admin/POS, dan
  work item completed di repository ini.
- `config/product-completeness.json`, `docs/FEATURE-CATALOG.md`,
  `docs/FUNCTIONAL-COMPLETENESS-W0-W2.md`, dan dokumen domain terkait.
- Audit statis pada 21 Oktober 2026. Tidak ada data produksi yang dibaca atau
  diubah.

### 2.2 Metode

1. Setiap frasa checklist dipetakan ke satu baris matriks.
2. Setiap baris dicari buktinya di schema/API/UI/test.
3. Status diberikan hanya berdasarkan bukti yang ditemukan.
4. Gap ditulis sebagai perilaku yang belum ada, bukan sebagai nama file.
5. Paket kerja dan gate disusun dari dependency data, bukan dari urutan UI.

### 2.3 Definisi status

| Status | Arti | Yang tidak boleh disimpulkan |
|---|---|---|
| `ADA` | Model/API/UI/alur ditemukan dan fitur dapat dijangkau pada source | Bukan bukti runtime, UAT, concurrency, atau Human Stage-20 |
| `SEBAGIAN` | Sebagian mekanisme ada, tetapi checklist belum terpenuhi penuh | Bukan berarti aman dipakai untuk produksi |
| `BELUM` | Tidak ditemukan model/API/UI/alur yang memadai | Tidak berarti mustahil; bisa jadi perlu modul baru |

Catatan: status `ADA` pada laporan ini sengaja konservatif. Banyak fitur masih
`FOUNDATION` atau `IMPLEMENTED_RUNTIME_PENDING` di matriks kanonik.

### 2.4 Batas audit

- Tidak ada browser click-through menyeluruh, load test, atau UAT.
- Tidak ada verifikasi terhadap dokumen/IPOS asli karena file sumber tidak ada.
- Beberapa item ambigu dan memakai asumsi yang dicatat di Bagian 5.
- Perubahan status runtime harus diverifikasi ulang saat paket kerja dimulai.
- Angka test, route, dan model tidak dikutip sebagai angka final; angka itu
  berubah dan harus diregenerasi dengan perintah di Lampiran B.

## 3. Ringkasan eksekutif

### 3.1 Cakupan checklist

Checklist dikelompokkan menjadi sepuluh domain:

| Kode | Domain | Bagian |
|---|---|---|
| A | Produk dan master data | 4.1 |
| B | Harga, diskon, pajak, dan HPP | 4.2 |
| C | Pembelian dan utang | 4.3 |
| D | Penjualan, POS, piutang, dan retur | 4.4 |
| E | Perakitan dan manufaktur | 4.5 |
| F | Persediaan dan multi-lokasi | 4.6 |
| G | Akuntansi | 4.7 |
| H | Laporan | 4.8 |
| I | Setting dan operasional | 4.9 |
| J | Konsinyasi | 4.10 |

Jumlah baris matriks: **138** — **67 `ADA`**, **26 `SEBAGIAN`**, **45 `BELUM`**.
Angka ini menghitung baris checklist, bukan jumlah work item. Satu baris
`SEBAGIAN`/`BELUM` bisa dipecah menjadi beberapa work item saat INTAKE.

### 3.2 Temuan paling berisiko

1. **HPP belum berbasis biaya.** Penjualan memakai `product.costPrice` statis
   (`apps/api/src/sales/sales.service.ts:1089`) dan laporan inventori memakai
   `costPrice × qty` (`apps/api/src/reports/reports.service.ts:663`). Tidak ada
   cost layer FIFO/LIFO/average, sehingga laba kotor dan nilai persediaan bisa
   berbeda dari biaya perolehan sebenarnya.
2. **Saldo awal dan tutup tahun belum operasional.** `OPENING_STOCK` ada di enum
   tetapi tidak dipakai; saldo awal akuntansi hanya bisa lewat jurnal manual;
   tutup tahun baru berupa kontrol periode, belum closing entries dan subledger
   opening yang dapat direkonsiliasi.
3. **Tipe item belum lengkap.** Hanya `PHYSICAL` dan `SERVICE`
   (`apps/api/src/products/dto/create-product.dto.ts:15`). Rakitan masih
   menumpang produk fisik, non-inventory menumpang jasa, dan `BIAYA` tidak ada.
4. **Kontrol pelanggan dan penjualan belum lengkap.** Belum ada customer group,
   credit limit, salesperson, komisi, deposit pelanggan, cek/BG, atau trade-in.
5. **Konsinyasi belum ada.** Tidak ada kepemilikan stok pihak ketiga, tagihan,
   pembayaran, atau laporan konsinyasi.
6. **Pertukaran data cabang dan migrasi masih terbatas.** Transfer beda lokasi
   ada lewat sync, tetapi export/import transfer, import transaksi cabang
   manual, migrasi IPOS, dan import master non-produk belum ada.
7. **Banyak gap ada di laporan dan setting.** COA report, deposit report,
   worksheet, sales per sales, customer display, info program, backup UI,
   empty data, dan DB maintenance belum tersedia sebagai alur operator.

### 3.3 Kesimpulan pembandingan

- Berdasarkan rekonstruksi checklist, seluruh kelompok fitur yang dikirim user
  sudah memiliki baris di Bagian 4. Tidak ada kelompok yang sengaja
  dihilangkan; item yang tidak dapat dipetakan dengan yakin dicatat sebagai
  asumsi di Bagian 5.
- Tidak ada kebutuhan untuk membangun ulang modul yang sudah ada. Semua paket
  harus memperluas inventory, accounting, tax, sales, purchasing, reporting,
  branch-sync, dan platform yang sudah menjadi sumber kebenaran.
- Gap terbesar bukan jumlah layar, tetapi **integritas biaya, saldo awal,
  kepemilikan stok, dan subledger**.
- Urutan yang aman adalah memperbaiki fondasi biaya dan saldo lebih dulu,
  kemudian parity operasional, lalu laporan/setting/migrasi.
- Status `ADA` tetap harus melewati runtime verification saat paketnya
  dikerjakan; dokumen ini tidak menaikkan status produk.

## 4. Matriks gap

Legenda prioritas:

- `P0` — correctness/data integrity; harus lebih dulu.
- `P1` — parity operasional yang diminta checklist.
- `P2` — kelengkapan laporan, setting, dan kenyamanan operator.
- `Jaga` — sudah ada; fokus regresi dan konsistensi.
- `P1/P2` — P1 bila konsinyasi dipakai pada go-live; P2 bila ditunda ke fase berikutnya.

Legenda dampak: `INV` inventory, `ACC` accounting, `TAX` pajak, `AR/AP`
piutang/utang, `SYNC` sinkronisasi, `PERF` performa, `UI` tampilan/operator,
`DB` schema/migration.

### 4.1 A — Produk dan master data

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| A01 | Tipe item Barang | `ADA` | `Product.productType = PHYSICAL`; DTO membatasi ke `PHYSICAL`/`SERVICE`; produk stok normal | Tidak ada gap dasar; jaga invariant stok | Jaga | INV |
| A02 | Tipe item Jasa | `ADA` | `Product.productType = SERVICE`; dijual tanpa stok | Tidak ada gap dasar; pastikan pajak dan COGS nol konsisten | Jaga | ACC, TAX |
| A03 | Tipe item Rakitan | `SEBAGIAN` | `ProductionRecipe`, `ProductionOrder`, BOM; output tetap produk fisik | Belum ada tipe item rakitan, routing, overhead, dan roll-up HPP | P1 | INV, ACC, DB |
| A04 | Tipe item Non Inventory | `SEBAGIAN` | Bisa memakai `SERVICE`; tidak ada tipe/flag non-inventory eksplisit | Perilaku pembelian/penjualan tanpa stok belum dibedakan dari jasa | P1 | INV, UI |
| A05 | Tipe item BIAYA | `BELUM` | DTO hanya mengizinkan `PHYSICAL`/`SERVICE`; tidak ada tipe `EXPENSE`/`BIAYA` | Item biaya untuk overhead, ongkos, dan absorption belum ada | P1 | ACC, INV |
| A06 | Kartu stok | `ADA` | Inventory movement dan laporan per produk/gudang | Jaga ledger append-only; tambah drill-down bila perlu | Jaga | INV |
| A07 | Cetak barcode | `ADA` | `product-bulk-labels`; Code128 A4/58mm | Tidak ada gap dasar; validasi printer dan label custom | Jaga | UI |
| A08 | Datasheet produk | `BELUM` | Tidak ada model/route/UI datasheet | Dokumen teknis, atribut, dan lampiran produk belum ada | P2 | UI, DB |
| A09 | Satuan/UOM | `ADA` | `ProductUnit`, konversi unit, harga per unit | Jaga konsistensi stok dasar vs unit jual | Jaga | INV |
| A10 | Kategori, jenis, merek | `ADA` | `Category`, `MasterReference` | Tidak ada gap dasar | Jaga | UI |
| A11 | Multi gudang | `ADA` | `Warehouse`, stok per gudang, transfer | Jaga scope tenant/cabang/gudang | Jaga | INV |
| A12 | Department | `BELUM` | Department HR tidak menjadi dimensi transaksi retail | Department untuk POS/biaya belum ada | P2 | UI, ACC |
| A13 | Ekspedisi/kurir | `ADA` | `Shipment`, carrier, tracking, delivery lifecycle | Tidak ada gap dasar | Jaga | UI |
| A14 | Bank dan e-money | `ADA` | `BankAccount`, payment method, cash-bank position | E-money mengandalkan konfigurasi payment method; belum ada ledger e-money khusus | Jaga | ACC |
| A15 | Wilayah pelanggan | `SEBAGIAN` | Alamat pelanggan menyimpan province/city | Belum ada master region, kecamatan, atau segmentasi wilayah | P2 | UI |
| A16 | Grup pelanggan | `BELUM` | `Customer.customerType` hanya string; tidak ada customer group | Harga/diskon per grup belum dapat diterapkan | P1 | AR/AP, UI |
| A17 | Poin pelanggan | `ADA` | Extension loyalty dan saldo poin | Jaga earning/redemption dan posting | Jaga | ACC |
| A18 | Harga per cabang, segmen, unit, min qty | `ADA` | `ProductPrice` dan UI pricing | Jaga prioritas price rule dan efektif tanggal | Jaga | UI, ACC |
| A19 | Riwayat harga jual | `ADA` | `ProductPriceHistory` + UI riwayat harga | Jaga audit trail perubahan harga | Jaga | UI |

### 4.2 B — Harga, diskon, pajak, dan HPP

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| B01 | Diskon periode | `ADA` | `Promotion` dengan `startsAt`/`endsAt` | Jaga validasi periode dan stacking | Jaga | ACC |
| B02 | Promo buy 2 get 1 | `ADA` | `BOGO`, `BUNDLE`, `QUANTITY_BREAK` | Jaga aturan kombinasi dan reversal | Jaga | ACC, INV |
| B03 | Promo tebus murah | `BELUM` | Tidak ada tipe promo tebus murah/voucher | Mekanisme beli X tebus Y dengan harga khusus belum ada | P1 | ACC, UI |
| B04 | Diskon per grup pelanggan | `BELUM` | Hanya `memberTier`; tidak ada customer group | Diskon per grup belum dapat dihitung | P1 | AR/AP, UI |
| B05 | Pajak default supplier | `ADA` | `Supplier.defaultTaxCodeId` | Jaga override per item/transaksi | Jaga | TAX |
| B06 | Pajak default customer | `ADA` | `Customer.defaultTaxCodeId`, `taxProfile` | Jaga validasi NPWP dan efektif tanggal | Jaga | TAX |
| B07 | Pajak per item | `ADA` | `taxCodeId` pada produk/varian/item | Jaga konsistensi produk, varian, dan unit | Jaga | TAX |
| B08 | Pajak per gudang | `BELUM` | `TaxCode` scoped company, bukan warehouse | Belum ada aturan pajak per gudang/lokasi | P1 | TAX |
| B09 | Include, exclude, non-pajak per transaksi | `SEBAGIAN` | `TaxCode.inclusive`; Sale/Order punya `taxIncluded`; PO tidak punya toggle per dokumen | Purchase document belum punya pilihan include/exclude/non yang eksplisit | P1 | TAX, ACC |
| B10 | PPN pembelian | `SEBAGIAN` | PO item punya `taxCodeId`; GR menyimpan `taxTotal` | Belum ada kontrol PPN per dokumen, warehouse, dan input tax reconciliation | P1 | TAX, ACC |
| B11 | HPP FIFO | `BELUM` | Tidak ada cost layer; COGS statis dari `product.costPrice` | Cost layer dan consumption per batch/sale belum ada | P0 | INV, ACC, DB |
| B12 | HPP LIFO | `BELUM` | Tidak ada cost layer LIFO | Metode LIFO belum ada | P0 | INV, ACC, DB |
| B13 | HPP average | `BELUM` | Tidak ada moving average/average cost | Average cost computation belum ada | P0 | INV, ACC, DB |
| B14 | HPP per item dan valuasi persediaan | `BELUM` | Valuasi `costPrice × qty`; bukan biaya perolehan | Nilai persediaan, margin, dan jurnal COGS belum akurat | P0 | INV, ACC, DB, PERF |

### 4.3 C — Pembelian dan utang

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| C01 | Purchase request | `ADA` | `PurchaseRequest` dan alur approval | Jaga scope dan konversi ke PO | Jaga | UI |
| C02 | Purchase order | `ADA` | `PurchaseOrder`, item, status, approval | Jaga perubahan setelah posting dan audit | Jaga | UI, ACC |
| C03 | Penerimaan barang | `ADA` | `GoodsReceipt`, inspeksi, konfirmasi, posting | Jaga idempotensi dan kaitan PO | Jaga | INV, ACC |
| C04 | Pembayaran utang | `ADA` | `FinanceTransactionType.SUPPLIER_PAYMENT`, settlement trace | Jaga partial payment dan alokasi | Jaga | AP |
| C05 | Aging utang | `ADA` | Laporan aging AP | Jaga bucket, due date, dan supplier scope | Jaga | AP |
| C06 | Cek/BG utang | `BELUM` | Tidak ada model/status cek atau giro | Lifecycle terima, setor, cair, tolak, dan jurnal belum ada | P1 | AP, ACC |
| C07 | Retur pembelian | `ADA` | `PurchaseReturn`, offset payable, credit note | Jaga reversal stok dan pajak | Jaga | INV, ACC, TAX |
| C08 | Deposit supplier | `BELUM` | Tidak ada supplier deposit/advance | Uang muka pembelian dan offset ke utang belum ada | P1 | AP, ACC |
| C09 | Riwayat harga beli dan price list supplier | `SEBAGIAN` | Hanya unit cost pada PO | Belum ada histori per supplier, perbandingan, dan price list berlaku | P1 | UI, ACC |

### 4.4 D — Penjualan, POS, piutang, dan retur

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| D01 | Pesanan penjualan | `SEBAGIAN` | `Order` storefront; POS tidak memakai sales order | Belum ada sales order/quotation POS, approval, dan konversi | P1 | UI, INV |
| D02 | DP pesanan penjualan | `BELUM` | Pembayaran ada, tetapi tidak ada skema DP/termin | Uang muka, pelunasan, dan pembatalan DP belum ada | P1 | ACC, AR |
| D03 | POS | `ADA` | POS, shift, payment, offline replay | Jaga FEFO, idempotensi, dan rekonsiliasi | Jaga | INV, ACC |
| D04 | Tukar tambah | `BELUM` | Tidak ada trade-in | Nilai tukar, stok bekas, dan jurnal belum ada | P1 | INV, ACC |
| D05 | Pembayaran piutang | `ADA` | `CUSTOMER_RECEIPT`, settlement trace | Jaga partial payment dan alokasi | Jaga | AR |
| D06 | Aging piutang | `ADA` | Laporan aging AR | Jaga bucket dan customer scope | Jaga | AR |
| D07 | Cek/BG piutang | `BELUM` | Tidak ada lifecycle cek/giro pelanggan | Terima, setor, cair, tolak, dan jurnal belum ada | P1 | AR, ACC |
| D08 | Retur penjualan | `ADA` | `SaleReturn`, inspeksi, refund, restock | Jaga reversal pajak dan stok | Jaga | INV, ACC, TAX |
| D09 | Komisi sales | `BELUM` | Tidak ada salesperson/commission | Aturan komisi per sales, produk, target belum ada | P1 | AR/AP, ACC |
| D10 | Pembayaran komisi | `BELUM` | Tidak ada payout komisi | Settlement dan jurnal komisi belum ada | P1 | ACC |
| D11 | Data pengiriman | `ADA` | `Shipment`, carrier, tracking | Jaga status dan bukti terima | Jaga | UI |
| D12 | Credit limit pelanggan | `BELUM` | Tidak ada limit/blocking kredit | Limit, override approval, dan aging block belum ada | P1 | AR, ACC |
| D13 | Salesperson dan pelanggan per sales | `BELUM` | Tidak ada field salesperson/assignment | Assignment, komisi, dan laporan per sales belum ada | P1 | UI, AR |

### 4.5 E — Perakitan dan manufaktur

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| E01 | Bill of materials | `ADA` | `ProductionRecipe` dan komponen | Jaga versi, yield, dan scrap | Jaga | INV |
| E02 | Pesanan perakitan | `ADA` | `ProductionOrder` | Jaga status, konsumsi, dan output | Jaga | INV |
| E03 | Proses/routing perakitan | `BELUM` | Tidak ada routing/operation | Urutan proses, work center, dan waktu belum ada | P1 | INV, ACC |
| E04 | Overhead dan tenaga kerja | `BELUM` | Tidak ada item BIAYA/overhead absorption | Biaya tenaga kerja dan overhead belum masuk HPP | P1 | INV, ACC |
| E05 | HPP hasil rakitan | `BELUM` | Belum ada roll-up biaya komponen + overhead | HPP rakitan belum dapat dihitung | P1 | INV, ACC |
| E06 | Penjualan hasil rakitan | `ADA` | Output menjadi produk fisik dan dijual normal | Tidak ada alur khusus; jaga HPP output | Jaga | INV, ACC |

### 4.6 F — Persediaan dan multi-lokasi

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| F01 | Item masuk | `ADA` | Inventory movement inbound | Jaga movement append-only | Jaga | INV |
| F02 | Item keluar | `ADA` | Inventory movement outbound | Jaga movement append-only | Jaga | INV |
| F03 | Saldo awal stok | `BELUM` | `InventoryMovementType.OPENING_STOCK` ada tetapi tidak dipakai | Opening stock per gudang/batch/biaya belum ada | P0 | INV, ACC, DB |
| F04 | Stock opname | `ADA` | Sesi opname, scan, submit, approval, adjustment | Jaga bukti dan reversal | Jaga | INV |
| F05 | Serial number | `ADA` | Serial lifecycle dan tracking | Jaga FOUNDATION vs runtime | Jaga | INV |
| F06 | Perbaikan saldo | `SEBAGIAN` | Dapat lewat opname/adjustment | Belum ada alur khusus dengan alasan, approval, dan audit | P1 | INV |
| F07 | Transfer satu LAN | `ADA` | Branch transfer/outbound-inbound | Jaga status dan idempotensi | Jaga | INV, SYNC |
| F08 | Transfer beda lokasi | `ADA` | Branch sync/transfer antar node | Jaga konflik dan source-of-truth | Jaga | INV, SYNC |
| F09 | Export/import transfer | `BELUM` | Tidak ada file exchange transfer | Transfer offline via file belum ada | P1 | INV, SYNC |
| F10 | Import transaksi cabang | `SEBAGIAN` | Hanya sync otomatis; tidak ada import manual | Import file transaksi cabang belum ada | P1 | SYNC, INV |
| F11 | Export/import master | `SEBAGIAN` | Hanya produk CSV | Diskon/promo, item, bank/e-money belum | P1 | UI, DB |
| F12 | Batch dan kedaluwarsa | `ADA` | Batch, expiry, FEFO di POS | Jaga FEFO dan invariant batch | Jaga | INV |
| F13 | Valuasi persediaan | `SEBAGIAN` | `costPrice × qty` | Belum memakai cost layer | P0 | INV, ACC |

### 4.7 G — Akuntansi

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| G01 | Chart of accounts | `ADA` | COA dan mapping akun | Jaga versioning dan kontrol | Jaga | ACC |
| G02 | Kas masuk | `ADA` | Finance operation dan jurnal | Jaga idempotensi | Jaga | ACC |
| G03 | Kas keluar | `ADA` | Finance operation dan jurnal | Jaga approval | Jaga | ACC |
| G04 | Transfer kas/bank | `ADA` | `CASH_TRANSFER`, `BANK_TRANSFER` | Jaga rekonsiliasi | Jaga | ACC |
| G05 | Saldo awal akuntansi | `SEBAGIAN` | Hanya manual journal | Belum ada wizard/import saldo awal per akun | P0 | ACC |
| G06 | Saldo awal utang/piutang | `SEBAGIAN` | Bisa lewat jurnal manual; tidak ada subledger opening | Aging awal tidak dapat direkonsiliasi per invoice | P0 | ACC, AR/AP |
| G07 | Tutup tahun | `SEBAGIAN` | Fiscal period/close control ada; closing entries belum | Laba ditahan, penutupan nominal, dan opening tahun berikut belum | P0 | ACC |
| G08 | Setting arus kas | `BELUM` | Tidak ada konfigurasi arus kas | Mapping aktivitas operasi/investasi/pendanaan belum ada | P1 | ACC |
| G09 | Kategori arus kas | `BELUM` | Tidak ada master kategori arus kas | Klasifikasi transaksi kas belum ada | P1 | ACC |
| G10 | Deposit pelanggan | `BELUM` | Tidak ada customer deposit/advance | Uang muka penjualan dan offset belum ada | P1 | ACC, AR |
| G11 | Jurnal | `ADA` | Journal dan posting | Jaga debit=kredit dan reversal | Jaga | ACC |
| G12 | Buku besar | `ADA` | General ledger | Jaga drill-down | Jaga | ACC |
| G13 | COA per gudang | `BELUM` | COA company-level | Belum ada ledger/akun per gudang | P2 | ACC |
| G14 | Financial integrity | `ADA` | Trial balance, posting checks, rekonsiliasi | Jaga gate | Jaga | ACC |
| G15 | Tax core dan period lock | `ADA` | Tax version/effective date, period lock | Jaga aturan pajak dan periode | Jaga | TAX, ACC |

### 4.8 H — Laporan

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| H01 | Laporan master | `ADA` | Report job products/suppliers/customers | Jaga filter dan export | Jaga | UI |
| H02 | Laporan pembelian | `ADA` | Report purchase | Jaga periode/supplier | Jaga | UI |
| H03 | Laporan penjualan | `ADA` | Report sales | Jaga channel/cabang | Jaga | UI |
| H04 | Laporan piutang/utang | `ADA` | AR/AP aging | Jaga bucket dan settlement | Jaga | AR/AP |
| H05 | Laporan persediaan | `ADA` | Inventory report | Nilai belum akurat karena HPP statis | Jaga | INV |
| H06 | Laporan kas | `ADA` | Cash flow/cash-bank position | Jaga klasifikasi | Jaga | ACC |
| H07 | Laba kotor | `ADA` | Margin report | Angka belum akurat tanpa cost layer | Jaga | ACC |
| H08 | Laba rugi sederhana | `ADA` | Profit-loss report | Jaga mapping akun | Jaga | ACC |
| H09 | Arus kas | `ADA` | Cash-flow report | Setting/kategori arus kas belum ada | Jaga | ACC |
| H10 | Laporan COA | `SEBAGIAN` | COA hanya layar, belum report job | Belum ada export/laporan COA | P2 | UI |
| H11 | Laporan deposit | `BELUM` | Tidak ada deposit report | Saldo dan mutasi deposit belum ada | P1 | ACC, AR/AP |
| H12 | Jurnal dan unbalanced | `ADA` | Journal + financial integrity | Jaga audit | Jaga | ACC |
| H13 | Buku besar | `ADA` | Ledger report | Jaga drill-down | Jaga | ACC |
| H14 | Trial balance | `ADA` | Trial balance | Jaga periode | Jaga | ACC |
| H15 | Worksheet/neraca lajur | `BELUM` | Tidak ada worksheet | Kolom penyesuaian dan closing belum ada | P1 | ACC |
| H16 | Grafik kas | `ADA` | Dashboard cash graph | Jaga data source | Jaga | UI |
| H17 | Neraca | `ADA` | Balance sheet | Jaga klasifikasi akun | Jaga | ACC |
| H18 | Laba rugi YTD | `ADA` | P&L YTD | Jaga periode | Jaga | ACC |
| H19 | Perbandingan periode/cabang | `ADA` | Period/branch comparison | Jaga filter | Jaga | UI |
| H20 | Penjualan per sales | `BELUM` | Tidak ada salesperson | Laporan per sales belum ada | P1 | AR/AP, UI |
| H21 | Penjualan per pelanggan | `ADA` | `CUSTOMERS` report dan relasi sale.customer | Jaga definisi metrik | Jaga | UI |
| H22 | Laporan riwayat harga | `SEBAGIAN` | Riwayat harga hanya di UI produk | Belum ada laporan/export riwayat harga | P2 | UI |

### 4.9 I — Setting dan operasional

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| I01 | User | `ADA` | Access control dan user management | Jaga scope | Jaga | UI |
| I02 | Company | `SEBAGIAN` | Nama, timezone, currency | Profil legal, NPWP, alamat, dan branding belum lengkap | P1 | UI, TAX |
| I03 | General | `SEBAGIAN` | `SystemSetting` terbatas | Belum ada UI setting umum yang lengkap | P2 | UI |
| I04 | Periode transaksi | `ADA` | Fiscal period dan lock | Jaga kontrol | Jaga | ACC |
| I05 | Penomoran | `SEBAGIAN` | Nomor otomatis; belum ada UI format | Prefix/sequence per dokumen belum dapat diatur | P2 | UI |
| I06 | Mini printer | `SEBAGIAN` | RawBT; belum ada konfigurasi printer | Setting printer/station belum ada | P2 | UI |
| I07 | Customer display | `BELUM` | Kiosk price-check bukan dual display | Layar pelanggan real-time belum ada | P2 | UI |
| I08 | Tema | `ADA` | Theme Admin/Storefront | Jaga konsistensi | Jaga | UI |
| I09 | Info program | `BELUM` | Tidak ada halaman info versi/build | Info deployment dan changelog belum ada | P2 | UI |
| I10 | Activity log | `ADA` | Audit/activity log | Jaga retensi dan akses | Jaga | UI |
| I11 | Analisis error | `SEBAGIAN` | Ops health, dead letter, report failure | Belum ada UI analisis error terpadu | P2 | UI |
| I12 | Modul terbuka | `SEBAGIAN` | Feature flags/module definitions | Belum ada kontrol modul per tenant yang lengkap | P2 | UI |
| I13 | Panduan | `SEBAGIAN` | Dokumentasi repo | Belum ada in-app guide | P2 | UI |
| I14 | Import Excel | `SEBAGIAN` | Hanya produk CSV | Master dan transaksi lain belum | P1 | DB, INV |
| I15 | Migrasi IPOS | `BELUM` | Tidak ada tool migrasi | Extract, map, validate, cutover belum ada | P1 | DB, INV, ACC |
| I16 | Export Excel | `SEBAGIAN` | CSV report/produk | Format Excel dan export master lain belum | P2 | UI |
| I17 | Backup, restore, autobackup | `SEBAGIAN` | Script dan metadata backup branch | Belum ada UI/verifikasi restore | P1 | DB |
| I18 | Kosongkan data | `BELUM` | Tidak ada alur empty data | Reset non-production yang aman belum ada | P2 | DB |
| I19 | Maintenance DB | `BELUM` | Tidak ada tool maintenance | Vacuum/analyze/retention UI belum ada | P2 | DB, PERF |

### 4.10 J — Konsinyasi

| ID | Item checklist | Status | Bukti / kondisi saat ini | Gap yang harus ditutup | Prioritas | Dampak |
|---|---|---|---|---|---|---|
| J01 | Pesanan konsinyasi masuk | `BELUM` | Tidak ada modul konsinyasi | Penerimaan barang milik supplier belum ada | P1/P2 | INV, AP |
| J02 | Konsinyasi per supplier/agen | `BELUM` | Tidak ada dimensi pemilik stok | Kepemilikan stok pihak ketiga belum ada | P1/P2 | INV |
| J03 | Pesanan konsinyasi keluar | `BELUM` | Tidak ada konsinyasi keluar | Pengiriman barang ke agen/toko lain belum ada | P1/P2 | INV, AR |
| J04 | Retur konsinyasi | `BELUM` | Tidak ada retur konsinyasi | Pengembalian barang belum ada | P1/P2 | INV |
| J05 | Status konsinyasi | `BELUM` | Tidak ada state machine | Draft, terkirim, terjual, retur, tagih belum ada | P1/P2 | INV, AR/AP |
| J06 | Tagihan konsinyasi | `BELUM` | Tidak ada billing konsinyasi | Tagihan per periode/supplier/agen belum ada | P1/P2 | AR/AP |
| J07 | Pembayaran konsinyasi | `BELUM` | Tidak ada settlement konsinyasi | Pembayaran dan offset belum ada | P1/P2 | AR/AP, ACC |
| J08 | Cek/BG konsinyasi | `BELUM` | Tidak ada cek/BG | Lifecycle cek/BG belum ada | P1/P2 | AR/AP, ACC |

## 5. Asumsi dan item yang perlu dikonfirmasi

Beberapa frasa checklist tidak punya padanan nama yang sama di Toko360. Agar
pembandingan tidak salah, asumsi berikut dipakai sementara. User perlu
mengoreksi bila maksud aslinya berbeda.

| Frasa checklist | Padanan sementara | Dampak bila asumsi salah |
|---|---|---|
| Non Inventory | `Product.productType = SERVICE` | Bisa jadi perlu tipe dan alur pembelian/penjualan tanpa stok sendiri |
| Pesanan penjualan | `Order` storefront | Bisa jadi yang dimaksud sales order POS/quotation |
| Customer display | Kiosk price-check | Bisa jadi perlu layar kedua real-time saat transaksi |
| Analisis error | Ops health/dead letter | Bisa jadi perlu UI khusus analisis log |
| Modul terbuka | Feature flags/module definitions | Bisa jadi perlu kontrol modul per tenant |
| Transfer beda lokasi | Branch sync/transfer | Bisa jadi perlu transfer file offline |
| Cek/BG | Tidak ada padanan | Perlu state machine dan akun tersendiri |
| Tebus murah | Tidak ada padanan | Perlu definisi mekanik promo |
| BIAYA | Tidak ada padanan | Perlu keputusan item vs akun beban |
| HPP | `product.costPrice` statis; seed setting `MOVING_AVERAGE` belum operasional | Perlu metode costing yang disetujui |
| Konsinyasi | Tidak ada padanan | Perlu keputusan supplier-owned vs agent-owned |
| Migrasi IPOS | Tidak ada tool | Perlu versi sumber, format, dan scope cutover |

Pertanyaan keputusan yang harus dijawab sebelum DESIGN paket terkait:

1. Metode HPP utama: FIFO, moving average, atau average periodik? Apakah LIFO
   hanya untuk pelaporan, atau harus menjadi metode operasional? Seed saat ini
   menyimpan `inventory.costing_method = MOVING_AVERAGE`, tetapi nilainya belum
   dipakai oleh perhitungan COGS; work item tidak boleh mengunci FIFO sebelum
   keputusan ini.
2. Apakah `Non Inventory` cukup memakai `SERVICE`, atau perlu tipe item
   tersendiri yang boleh dibeli tanpa stok?
3. Apakah `BIAYA` adalah tipe item yang masuk PO/GR, atau hanya akun beban
   untuk overhead perakitan?
4. Bagaimana mekanik `tebus murah`: voucher, bundle, atau harga khusus setelah
   qty tertentu?
5. Apakah cek/BG harus mendukung endorsed, deposited, cleared, dan bounced
   untuk AR dan AP?
6. Apa definisi customer display: layar kedua saat POS atau kiosk mandiri?
7. Apakah konsinyasi wajib sekarang? Jika ya, barang milik supplier atau
   milik agen?
8. Versi IPOS sumber migrasi (3/4), format export, dan scope: master saja,
   saldo awal, atau transaksi historis?
9. Apakah sales order harus tersedia di POS, atau cukup storefront?
10. Apakah transfer beda lokasi harus bisa lewat file offline, atau sync cukup?
11. Apakah pajak per gudang benar-benar dibutuhkan, atau cukup per company?
12. Apakah COA per gudang berarti ledger terpisah, atau dimensi gudang pada
    laporan yang sama?
13. Apakah tutup tahun harus membuat closing entries otomatis, atau cukup
    worksheet dan jurnal manual yang disetujui?
14. Apakah komisi sales dihitung per item, kategori, target, atau margin?

### 5.1 Keputusan yang sudah diambil

| Tanggal | Keputusan | Nilai |
|---|---|---|
| 2026-10-21 | Metode HPP default | `MOVING_AVERAGE`; FIFO dan LIFO dapat dipilih sebagai policy; average periodik tidak termasuk P0 |
| 2026-10-21 | Mode tutup tahun | Preview worksheet, approval maker-checker, lalu auto-post closing entries; opening tahun berikut berupa snapshot saldo akhir, bukan jurnal duplikat |
| 2026-10-21 | Sumber saldo awal | Import batch CSV/Excel, dry-run, approval, dan koreksi manual terbatas |

## 6. Prinsip arsitektur yang tidak boleh dilanggar

1. **Satu modul, satu sumber kebenaran.** Costing masuk inventory/accounting
   core; komisi dan deposit masuk finance/AR-AP; konsinyasi memakai inventory
   ownership, bukan gudang kedua yang terpisah.
2. **Tenant dan scope.** Setiap data baru wajib memiliki `companyId`,
   `branchId`/warehouse scope, permission, dan audit. Identitas tenant berasal
   dari konteks tepercaya, bukan parameter bebas.
3. **Stok append-only.** Saldo awal, koreksi, transfer, konsinyasi, dan hasil
   produksi hanya boleh mengubah stok lewat inventory movement yang atomik dan
   dapat dibalik.
4. **Accounting core.** Jurnal HPP, overhead, komisi, deposit, cek/BG, dan
   konsinyasi tidak boleh ditanam di modul transaksi. Semua lewat posting rule
   accounting core.
5. **Tax core.** Tarif dan aturan pajak berversi, bertanggal efektif, dan tidak
   diubah in-place.
6. **Idempotency.** Import, migrasi, posting ulang, komisi, deposit, dan
   konsinyasi wajib punya operation key yang unik.
7. **Expand-only migration.** Tidak ada `db push`, reset, atau drop destruktif
   untuk production. Semua perubahan schema memiliki backfill, rollback, dan
   baseline PostgreSQL yang diregenerasi.
8. **Async untuk beban besar.** Migrasi, export, rekonsiliasi, laporan, dan
   posting massal berjalan batch/worker dengan checkpoint, retry, dan
   dead-letter.
9. **Feature flag.** Costing, konsinyasi, komisi, dan migrasi harus bisa
   dimatikan tanpa rollback schema.
10. **No duplicate modules.** Sebelum membuat model/service baru, cari model
    dan alur yang sudah ada; perluas, jangan salin.

## 7. Paket kerja

Satu paket belum tentu satu work item. Jika satu paket menyentuh schema besar,
accounting, dan UI sekaligus, pecah menjadi beberapa work item dengan dependency
yang eksplisit. Setiap work item tetap mengikuti fase resmi di
`docs/DEVELOPMENT-WORKFLOW.md`.

| Paket | Hasil | Basis yang diperluas | Dependensi | Wave | Risiko | Gate utama |
|---|---|---|---|---|---|---|
| PKG-00 | Keputusan ruang lingkup dan sign-off dokumen | Dokumen ini | - | W0 | LOW | Checklist disetujui |
| PKG-01 | Costing engine dan valuasi | Inventory, sale COGS, report | PKG-02 untuk opening layer | W1/W3 | CRITICAL | Rekonsiliasi cost layer dan jurnal |
| PKG-02 | Saldo awal dan tutup tahun | Inventory movement, accounting core | PKG-01 untuk nilai awal | W1/W3 | CRITICAL | Trial balance dan stock reconciliation |
| PKG-03 | Tipe item dan BIAYA | Product, purchasing, sales | Schema + UI + permission | W1 | HIGH | Backward compatibility tipe lama |
| PKG-04 | Routing, overhead, HPP rakitan | Manufacturing, BIAYA, costing | PKG-01, PKG-03 | W1/W3 | HIGH | Roll-up biaya dan WIP |
| PKG-05 | Customer group, credit, salesperson, komisi, price list | Customer, AR, pricing, tax | PKG-01 untuk margin komisi | W1/W2 | HIGH | Concurrency credit limit, idempotensi komisi |
| PKG-06 | Promo tebus murah dan loyalty parity | Promotion, pricing, loyalty | PKG-05 untuk group | W2 | MEDIUM | Aturan stacking dan reversal |
| PKG-07 | PPN pembelian, cek/BG AP, deposit supplier | Purchasing, tax, finance | PKG-02 untuk saldo awal | W1/W3 | HIGH | Tax reconciliation dan state machine |
| PKG-08 | Sales order/DP, trade-in, cek/BG AR, deposit customer | Sales, POS, AR, inventory | PKG-01, PKG-05 | W2/W3 | HIGH | Idempotensi dan jurnal |
| PKG-09 | Transfer file, import cabang, import/export master | Branch transfer/sync, platform | PKG-10 untuk format | W1/W6 | HIGH | Dry-run dan conflict handling |
| PKG-10 | COA per gudang, arus kas, deposit/worksheet report | Accounting, reporting | PKG-02, PKG-07, PKG-08 | W3/W7 | HIGH | Trial balance dan report reconciliation |
| PKG-11 | Setting, backup UI, migrasi IPOS, maintenance | Platform, settings, migration | Schema stabil dari PKG-01..10 | W0/W7 | HIGH | Dry-run migration dan restore drill |
| PKG-12 | Konsinyasi end-to-end | Inventory ownership, AR/AP, billing | PKG-01, PKG-07, PKG-08 | W1/W2/W3 | CRITICAL | Ownership, billing, payment reconciliation |
| PKG-13 | Hardening, performance, UAT | Semua paket | PKG-01..12 | W7 | HIGH | P95/P99, UAT, Human Stage-20 |

Work item P0 yang sudah dibuat: PKG-01
`T360-20261021-134120-costing-engine-dan-valuasi-persediaan`; PKG-02
`T360-20261021-134133-saldo-awal-dan-tutup-tahun` (dependency PKG-01).

Design P0 (ACCEPTED 2026-10-21; costing memasuki IMPLEMENTATION, opening menunggu fondasi costing):

- `docs/adr/ADR-T360-20261021-134120-COSTING-METHOD.md` — moving average
  default, FIFO/LIFO policy, cost event/state/layer, shadow-to-active.
- `docs/adr/ADR-T360-20261021-134133-OPENING-BALANCE-CUTOVER.md` — opening
  batch CSV/Excel, opening stock/AR/AP/GL, preview + approval + auto-post
  closing, subledger tie-out, reversal.

### 7.1 Isi minimum setiap paket

**PKG-01 — Costing dan valuasi**

- Cost layer per produk/gudang/batch, consumption per sale, dan reversal.
  Costing per varian ditunda karena stock ledger belum memiliki `variantId`.
- Dukungan FIFO, LIFO, dan average sesuai keputusan user.
- COGS dari cost layer, bukan `costPrice` statis.
- Valuasi persediaan dan margin report memakai cost layer.
- Backfill/opening layer, parallel run, dan rekonsiliasi.
- Test: concurrency, negative stock, backdated receipt, retur, reversal,
  rebuild, dan performa.

**PKG-02 — Saldo awal dan tutup tahun**

- Opening stock per gudang/batch/nilai.
- Opening AR/AP per invoice, due date, pajak, dan pembayaran.
- Opening account balance dengan kontrol debit=kredit.
- Closing entries, laba ditahan, snapshot opening tahun berikut (bukan jurnal
  duplikat), dan period lock.
- Worksheet/neraca lajur bila disetujui.
- Test: trial balance, subledger tie-out, closing reversal, idempotensi.

**PKG-03 — Tipe item dan BIAYA**

- Tipe `NON_INVENTORY`, `ASSEMBLY`, `EXPENSE`/`BIAYA` sesuai keputusan.
- Aturan stok, pembelian, penjualan, pajak, dan HPP per tipe.
- Migrasi tipe lama tanpa memecah produk yang sudah ada.
- UI master data, validasi, permission, dan audit.

**PKG-04 — Routing, overhead, HPP rakitan**

- Routing/operation, work center, waktu, dan scrap.
- Konsumsi komponen, output, dan WIP.
- Overhead/tenaga kerja masuk cost layer output.
- HPP rakitan dan reversal.
- Test: BOM explosion, partial completion, scrap, overhead absorption.

**PKG-05 — Customer, credit, salesperson, komisi, price list**

- Customer group dan segmentasi harga.
- Credit limit, blocking, override approval, dan aging.
- Salesperson assignment dan komisi per aturan.
- Price list supplier dan riwayat harga beli.
- Pajak per supplier/customer/item/gudang sesuai keputusan.
- Test: race credit limit, idempotensi komisi, perhitungan margin.

**PKG-06 — Promo dan loyalty**

- Tebus murah, voucher, bundle, dan aturan stacking.
- Diskon per grup.
- Earn/redeem poin dan liabilitas.
- Reversal dan audit.
- Test: kombinasi promo, batas periode, dan perhitungan pajak.

**PKG-07 — Procurement dan AP controls**

- PPN pembelian per dokumen, warehouse, dan input tax.
- Cek/BG AP: diterima, disetor, cair, ditolak, dan jurnal.
- Deposit supplier dan offset.
- Purchase price history dan price list.
- Test: state machine, partial payment, reversal, tax.

**PKG-08 — Sales dan AR controls**

- Sales order/quotation, DP, pelunasan, pembatalan.
- Trade-in dan stok barang bekas.
- Cek/BG AR.
- Deposit customer.
- Komisi payout.
- Test: DP vs pelunasan, idempotensi, jurnal, stok.

**PKG-09 — Inventory dan branch exchange**

- Export/import transfer.
- Import transaksi cabang manual.
- Export/import master non-produk.
- Balance repair dengan alasan dan approval.
- Test: file validation, duplicate, conflict, resume, rollback.

**PKG-10 — Accounting dan reporting**

- COA per gudang/ledger dimension.
- Cash flow settings dan kategori.
- Deposit report, COA report, worksheet, sales per sales, price history
  report.
- Test: trial balance, report reconciliation, filter, export.

**PKG-11 — Setting, backup, migrasi, maintenance**

- Company/general settings, numbering, printer, customer display, info
  program.
- Error analysis, guide, open modules.
- Excel import/export, backup/restore UI, empty data, DB maintenance.
- Migrasi IPOS: extract, map, validate, dry-run, cutover, rollback.
- Test: migration rehearsal, restore drill, idempotensi.

**PKG-12 — Konsinyasi**

- Kepemilikan stok, pesanan masuk/keluar, retur, status, tagihan, pembayaran,
  cek/BG.
- Pemisahan stok milik sendiri vs pihak ketiga.
- Jurnal dan laporan konsinyasi.
- Test: ownership, sale/return, billing, payment, reconciliation.

**PKG-13 — Hardening dan UAT**

- Pagination, index, query plan, batch, retry, dead-letter.
- UAT per peran dan cabang.
- Rekonsiliasi stok, HPP, jurnal, pajak, AR/AP.
- Human Stage-20 dan release evidence.

## 8. Urutan delivery yang disarankan

Urutan ini menjaga agar fitur hilir tidak dibangun di atas biaya dan saldo yang
salah.

### Gelombang 0 — Keputusan dan persetujuan

- Setujui checklist, status, asumsi, prioritas, dan keputusan Bagian 5.
- Tetapkan metode costing, definisi BIAYA/non-inventory, konsinyasi, cek/BG,
  customer display, dan scope migrasi.
- Belum ada coding.

**Exit:** dokumen ditandatangani; paket pertama boleh masuk INTAKE.

### Gelombang 1 — Fondasi biaya dan saldo

- PKG-01 Costing.
- PKG-02 Saldo awal dan tutup tahun.
- PKG-03 Tipe item dan BIAYA bila menjadi dependency costing/overhead.

**Exit:** HPP, nilai persediaan, trial balance, opening AR/AP, dan closing
entries lulus rekonsiliasi pada data sintetis.

### Gelombang 2 — Manufaktur dan kontrol pelanggan

- PKG-04 Routing/overhead/HPP rakitan.
- PKG-05 Customer group, credit, salesperson, komisi, price list.

**Exit:** HPP rakitan, credit limit, komisi, dan price list lulus concurrency
dan reconciliation.

### Gelombang 3 — Procurement, sales, dan AR/AP

- PKG-07 PPN pembelian, cek/BG AP, deposit supplier.
- PKG-08 Sales order/DP, trade-in, cek/BG AR, deposit customer, payout.
- PKG-06 Promo dan loyalty bila dibutuhkan sales.

**Exit:** state machine cek/BG, DP, deposit, dan komisi lulus idempotensi serta
jurnal.

### Gelombang 4 — Inventory, branch, dan reporting

- PKG-09 Transfer file, import cabang, import/export master.
- PKG-10 Accounting dan reporting.
- PKG-11 Setting, backup UI, migrasi IPOS, maintenance.

**Exit:** dry-run migrasi, restore drill, report reconciliation, dan branch
exchange lulus.

### Gelombang 5 — Konsinyasi dan hardening

- PKG-12 Konsinyasi end-to-end bila disetujui.
- PKG-13 Hardening, performance, UAT, Human Stage-20.

**Exit:** semua paket yang disetujui CLOSED; residual risk dan known issue
tercatat; release evidence lengkap.

## 9. Workflow per paket

Setiap paket wajib mengikuti siklus resmi. Ringkasnya:

### 9.1 INTAKE

- Tulis masalah bisnis, pengguna, cabang, dan outcome.
- Referensikan ID checklist (A01, B11, dan seterusnya).
- Tetapkan baseline: fitur `ADA`/`SEBAGIAN`/`BELUM` dan bukti yang dipakai.
- Tentukan scope yang tidak dikerjakan.

**Exit:** masalah nyata, pemilik keputusan jelas, dan scope tidak tumpang
tindih dengan paket lain.

### 9.2 ANALYSIS

Isi dampak wajib:

| Domain | Pertanyaan minimum |
|---|---|
| Database | Tabel/kolom/index baru, backfill, volume, migration plan |
| Inventory | Movement, cost layer, batch, gudang, negative stock, reversal |
| Accounting | Posting rule, debit=kredit, period lock, reversal, subledger |
| Tax | Versi, effective date, include/exclude, input/output, retur |
| Payment | DP, deposit, cek/BG, refund, idempotency |
| AR/AP | Aging, credit limit, settlement, write-off |
| Sync | Source-of-truth, retry, duplicate, conflict, offline |
| Security | Permission, tenant/branch/warehouse, audit, data sensitif |
| Performance | Pagination, index, query plan, batch, P95/P99 |

**Exit:** invariant, risiko, dependency, dan acceptance criteria dapat diuji.

### 9.3 DESIGN

Hasil minimum:

- Alur normal, gagal, batal, retry, dan reversal.
- ERD/schema dan migration expand-only.
- API contract, permission, dan audit event.
- Posting accounting/tax.
- Feature flag dan default aman.
- Backfill, rekonsiliasi, rollback, monitoring.
- UI state untuk Admin/POS bila relevan.
- ADR untuk costing, konsinyasi, cek/BG, migrasi, atau perubahan lintas
  modul.

**Exit:** desain disetujui dan tidak ada pertanyaan blocker.

### 9.4 IMPLEMENTATION

Urutan aman:

1. Kontrak bersama dan feature flag.
2. Migration expand-only.
3. Domain service dan invariant.
4. API dan permission.
5. Outbox/worker/import adapter.
6. UI.
7. Seed/configuration.
8. Dokumentasi dan test.

Jangan menggabungkan schema besar, refactor massal, dan fitur bisnis dalam satu
PR.

### 9.5 VERIFICATION

Wajib:

```bash
npm run quality:fast
npm run db:local:reset
npm run test:db:smoke
npm run quality:full
```

Tambahan sesuai dampak:

- Inventory: concurrency, negative stock, movement balance, FEFO, reversal.
- Accounting: debit=kredit, trial balance, period lock, closing, reversal.
- Tax: versi, effective date, inclusive/exclusive, retur.
- AR/AP: credit limit race, deposit, cek/BG state, aging.
- Manufacturing: BOM, scrap, WIP, overhead, output cost.
- Consignment: ownership, sale/return, billing, payment.
- Sync: idempotency, retry, duplicate, conflict, checkpoint.
- Performance: query plan, index, P95/P99, export async.
- Security: tenant/branch/warehouse scope, permission, audit, secret.

### 9.6 STAGING

- PostgreSQL, bukan SQLite.
- Data sintetis dengan volume yang mewakili production.
- Migration dan backfill dapat dilanjutkan ulang.
- Smoke test modul terdampak.
- UAT pemilik proses.
- Feature flag default aman.
- Dashboard/alert aktif.
- Backup dan restore point tersedia.

### 9.7 RELEASE_READY dan RELEASED

- `releaseEvidence` wajib: CI, UAT, query plan, rekonsiliasi.
- Rencana deployment, urutan migration, aktivasi flag, observasi, rollback,
  dan compensating operation.
- Setelah rilis: pantau error, latency, queue age, lock, dan invariant.
- Rekonsiliasi stok/HPP/jurnal/pajak/AR-AP sebelum CLOSED.
- Human Stage-20 tidak boleh diganti otomatisasi.

## 10. Quality gate khusus paritas

| Domain | Gate minimum |
|---|---|
| Costing | Cost layer balance, COGS reconciliation, backdated receipt, reversal, rebuild, concurrent sale |
| Opening balance | Stock qty = movement opening, AR/AP subledger = control account, trial balance seimbang |
| Year-end | Closing entries, retained earnings, next-year opening, period lock, reversal |
| Item type | Produk lama tetap valid, tipe baru tidak bocor ke stok, permission dan audit |
| Manufacturing | BOM explosion, scrap, WIP, overhead absorption, output valuation |
| Customer/credit | Credit limit race, override approval, aging block, tenant scope |
| Commission | Idempotency, perhitungan margin, payout, reversal |
| Tax | Versi/effective date, inclusive/exclusive, input/output, retur, per warehouse |
| Cek/BG | State machine, partial clearing, bounce, reversal, journal |
| Deposit | Liability balance, offset, refund, aging |
| Consignment | Ownership, stock not counted as owned, billing, payment, return |
| Branch exchange | File validation, duplicate, conflict, resume, rollback |
| Migration | Dry-run, count reconciliation, idempotent rerun, cutover, restore |
| Performance | Pagination, index, query plan, P95/P99, async export |
| Security | Tenant/branch/warehouse isolation, permission, audit, sensitive data |

## 11. Migration, backfill, dan rollback

### 11.1 Aturan umum

- Expand-only: tambah tabel/kolom nullable, backfill, baru kontrakkan.
- Setiap migration punya versi, checksum, dan urutan.
- Backfill idempotent, batch, checkpoint, dan bisa dilanjutkan.
- Tidak ada reset, `db push`, atau drop destruktif untuk production.
- Baseline PostgreSQL diregenerasi dan diuji setiap schema berubah.
- Data production tidak dipakai sebagai data test.

### 11.2 Costing

- Tetapkan cutover date dan freeze stok.
- Snapshot qty dan unit cost per produk/gudang/batch.
- Buat opening cost layer dari snapshot.
- Jika data historis tidak lengkap, mulai dari cutover dan catat keterbatasan;
  jangan mengarang layer historis.
- Parallel run: COGS lama vs baru, selisih, dan alasan.
- Rekonsiliasi: nilai persediaan, COGS, margin, dan jurnal.
- Jangan menulis ulang COGS historis tanpa persetujuan dan rencana
  restatement.

### 11.3 Saldo awal AR/AP

- Import per invoice: customer/supplier, tanggal, jatuh tempo, pajak, dan
  pembayaran.
- Rekonsiliasi subledger ke control account.
- Aging awal harus sama dengan saldo control account.
- Dokumen tanpa sumber yang jelas masuk ke suspense dan direview.

### 11.4 Tutup tahun

- Kunci periode.
- Buat closing entries ke laba ditahan.
- Buat snapshot opening tahun berikut (bukan jurnal duplikat).
- Rekonsiliasi trial balance dan subledger.
- Sediakan reversal/compensating bila ada koreksi setelah tutup.

### 11.5 Migrasi IPOS

- Tetapkan versi dan format sumber.
- Mapping master, saldo awal, dan transaksi.
- Validasi jumlah baris, total, dan referensi.
- Dry-run ke database staging.
- Rekonsiliasi stok, AR/AP, dan COA.
- Cutover dengan freeze, checkpoint, dan rollback.
- Simpan log migrasi dan idempotency key.

### 11.6 Rollback

- Feature flag off untuk menghentikan alur baru.
- Hentikan write, simpan checkpoint, restore snapshot bila perlu.
- Untuk data yang sudah diposting, gunakan reversal/compensating, bukan edit
  langsung.
- Rekonsiliasi ulang sebelum mengaktifkan kembali.
- Catat rollback dan dampaknya di work item.

## 12. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Perubahan HPP mengubah laba historis | Laporan dan pajak | Cutover date, parallel run, disclosure, no rewrite tanpa approval |
| Stok drift saat opening/import | Stok dan jurnal | Freeze, reconciliation, movement append-only, idempotency |
| Cost layer race | Negative stock/salah COGS | Transaksi serializable/conditional, concurrency test |
| Pajak salah klasifikasi | Kepatuhan | Tax core version, effective date, UAT, review |
| Komisi/deposit ganda | Kerugian | Idempotency key, unique constraint, reconciliation |
| Konsinyasi tercampur stok sendiri | Aset salah | Owner dimension, location terpisah, report |
| Sync conflict | Data ganda | Source-of-truth, receipt, conflict resolution, dead-letter |
| Migrasi file besar | Downtime | Batch, checkpoint, worker, dry-run, restore drill |
| Scope creep | Tidak selesai | Satu paket satu outcome, gate, no big-bang PR |
| Human Stage-20 | Tidak release | UAT awal, acceptance criteria, evidence |

## 13. Sign-off dokumen

Dokumen ini siap dipakai sebagai baseline kerja hanya setelah user menyetujui:

- [x] Semua item checklist IPOS sudah muncul di Bagian 4.
- [x] Status `ADA`/`SEBAGIAN`/`BELUM` sesuai bukti dan pemahaman user.
- [x] Asumsi di Bagian 5 benar, atau sudah dikoreksi.
- [x] Prioritas P0/P1/P2 sesuai kebutuhan bisnis.
- [ ] Urutan gelombang di Bagian 8 disetujui.
- [ ] Keputusan metode HPP, BIAYA, konsinyasi, cek/BG, customer display, dan
      migrasi sudah dijawab.
- [ ] Tidak ada implementasi sebelum paket pertama masuk INTAKE dan DESIGN.

**Catatan sign-off 21 Oktober 2026:** user menyetujui checklist, status,
asumsi, dan prioritas, serta meminta mulai P0. Persetujuan ini belum menjawab
keputusan desain terinci; keputusan tersebut tetap menjadi blocker DESIGN.

Work item P0 yang sudah dibuat:

- PKG-01: `T360-20261021-134120-costing-engine-dan-valuasi-persediaan`.
- PKG-02: `T360-20261021-134133-saldo-awal-dan-tutup-tahun` (dependency PKG-01).

Setelah sign-off:

1. Buat work item untuk paket pertama dengan ID resmi. **(selesai)**
2. Jalankan INTAKE dan ANALYSIS. **(berjalan)**
3. Selesaikan DESIGN dan migration plan.
4. Baru mulai IMPLEMENTATION.

## Lampiran A — Indeks bukti utama

| Area | Bukti |
|---|---|
| Tipe produk | `apps/api/src/products/dto/create-product.dto.ts:15`; `Product.productType` berupa string yang dibatasi DTO ke `PHYSICAL`/`SERVICE` |
| COGS statis | `apps/api/src/sales/sales.service.ts:1089` |
| Valuasi statis | `apps/api/src/reports/reports.service.ts:663` |
| Promo | `apps/api/src/promotions/promotions.service.ts:63` |
| Opening stock | `InventoryMovementType.OPENING_STOCK` di schema; tidak ada pemakaian API |
| Costing | Tidak ada model cost layer; `ProductPriceHistory` hanya perubahan harga |
| Pelanggan | `Customer.customerType`, `Customer.defaultTaxCodeId`, `Customer.points` |
| Supplier | `Supplier.defaultTaxCodeId`, `paymentTermDays` |
| Pajak | `TaxCode` version/effective date/inclusive; `Sale.taxIncluded`; PO tanpa `taxIncluded` |
| Finance | `FinanceTransactionType` (`CUSTOMER_RECEIPT`, `SUPPLIER_PAYMENT`, `CASH_TRANSFER`, `BANK_TRANSFER`) |
| Inventory | `InventoryMovement`, batch/expiry, FEFO helper `apps/api/src/common/batch-fefo.ts` |
| Manufacturing | `ProductionRecipe`, `ProductionOrder`; tidak ada routing/overhead |
| Branch | `apps/api/src/branch-sync/`, `apps/api/src/branch-continuity/` |
| Accounting | `apps/api/src/accounting-core/`, `apps/api/src/finance-operations/` |
| Reporting | `apps/api/src/reports/` |
| UI pricing/history | `apps/admin/app/modules/master-data.tsx` |
| UI company | `apps/admin/app/modules/organization-admin.tsx` |
| POS printing | `apps/pos/lib/printing.ts` |
| Workflow | `scripts/workflow.mjs`, `config/workflow-policy.json` |
| Baseline | `scripts/build-postgres-baseline.mjs`, `database/postgresql/releases/0001_baseline.sql` |
| Status kanonik | `config/product-completeness.json` |
| Handoff | `handoff/CURRENT-WORK.md` |

## Lampiran B — Perintah verifikasi

Dokumen:

```bash
node scripts/workflow.mjs validate
npm run validate:repo
```

Code gate penuh:

```bash
npm run quality:fast
npm run db:local:reset
npm run test:db:smoke
npm run quality:full
```

Baseline PostgreSQL:

```bash
npm run db:baseline:postgres
npm run db:baseline:postgres:check
```

Regenerasi audit yang tidak boleh dikutip dari prose:

```bash
npm run audit:full:repo
npm run audit:p5:visual
node scripts/run-f1-backend-ui-audit.mjs
```

## Lampiran C — Riwayat dokumen

| Tanggal | Perubahan |
|---|---|
| 2026-10-21 | Baseline gap IPOS dibuat dari audit source-level; belum ada implementasi |
