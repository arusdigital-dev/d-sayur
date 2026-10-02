# D-Sayur — headless Odoo eCommerce

Storefront ini mengikuti brief riset D-Sayur: pengalaman belanja mobile-first untuk bahan pangan lokal, kategori paket siap masak/UMKM, alur browse → cart → checkout → status pesanan, dan pengembangan delivery/loyalty sebagai konfigurasi bisnis. Aplikasi ditujukan sebagai prototype demo tertutup; bukan peluncuran publik atas nama klien.

## Batas tanggung jawab

```text
Browser → Next.js (UI, rendering, same-origin BFF) → addon REST tipis → Odoo Community 20
                                                                  └→ website_sale / sale / stock / delivery / payment
Odoo → PostgreSQL milik Odoo
```

Next.js tidak memiliki database bisnis sendiri. Odoo menjadi sumber utama produk, varian, harga/pricelist, stok, cart, order, pelanggan, pajak, delivery, dan transaksi pembayaran. Addon `odoo/addons/dsayur_headless` hanya membentuk kontrak JSON dan mendelegasikan operasi yang didukung ke model/metode Odoo. API key berada di server Next.js dan Odoo; browser hanya menerima session cookie HttpOnly. PostgreSQL aplikasi lama tidak dipakai runtime dan tidak dihapus.

## Persyaratan dan konfigurasi

- Node.js yang didukung Next.js 16 dan npm.
- Odoo Community 20 yang berjalan secara lokal, dengan addon path mencakup folder `odoo/addons`.
- Database Odoo khusus D-Sayur. Jangan arahkan ke database produksi atau instalasi Odoo 19 yang berbeda.
- Modul Odoo `website_sale`, `website_sale_stock`, `delivery`, `payment`, `auth_signup`, dan addon headless ini.

Salin `.env.example` ke `.env.local`, lalu atur:

```dotenv
ODOO_URL=http://localhost:8079
ODOO_DATABASE=dsayur
ODOO_API_KEY=<secret-random-panjang>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Atur API key yang sama pada Odoo system parameter `dsayur_headless.api_key`. Rahasia Odoo tidak boleh memakai prefix `NEXT_PUBLIC_`. `ODOO_DATABASE` disimpan sebagai dokumentasi/setup target; endpoint harus menggunakan database Odoo yang dipilih pada server dan konfigurasi instance.

## Setup Odoo Community 20 (tanpa Docker)

1. Install Odoo Community 20 dan PostgreSQL tanpa Docker. Untuk workstation ini, Odoo Community `20.0.20260930` memakai service `odoo-server-20.0`, PostgreSQL 16, database baru `dsayur`, dan HTTP port `8079`.
2. Addon path Odoo 20 harus mencakup folder `odoo/addons` pada repo ini. Skrip lokal `scripts/configure-odoo20.ps1` mengatur addon path/port/database, menjalankan upgrade serta test addon, dan menyinkronkan API key dari `.env.local`; jalankan dari PowerShell Administrator. Skrip ini memakai path instalasi spesifik workstation ini.
3. Odoo 20 mengaktifkan `website_sale`, `website_sale_stock`, `delivery`, `payment`, `auth_signup`, dan addon **D-Sayur Headless Storefront API** pada database `dsayur`.
4. Buat pricelist/currency IDR, kategori publik, produk/varian, aturan pajak, gudang/stok, dan delivery carrier melalui konfigurasi native Odoo. Database baru saat ini masih kosong dari produk katalog.
5. Health endpoint aktif di `http://localhost:8079/dsayur/api/health`. API key harus cocok antara `.env.local` dan system parameter Odoo `dsayur_headless.api_key`.

Odoo 19 Enterprise lama tetap berjalan terpisah pada port `8078`; jangan arahkan storefront D-Sayur ke instance itu. PostgreSQL 16 yang sama mengelola database Odoo, sementara database aplikasi lama tidak dihapus.

## Menjalankan

```powershell
npm.cmd install
npm.cmd run dev:all
```

`dev:all` memeriksa health endpoint, API key, database target, serta memastikan Odoo merespons sebagai versi 20; setelah itu menjalankan Next.js di `http://localhost:3000`. Service Windows Odoo/PostgreSQL pada workstation ini start otomatis. Hentikan Next.js dengan `Ctrl+C`; service Odoo/PostgreSQL tetap berjalan. Bisa juga gunakan `npm.cmd run dev`.

## Kontrak saat ini

Addon `dsayur_headless` menyediakan (semuanya lewat BFF Next.js, tanpa database bisnis di Next):

- Katalog/kategori yang dipublikasikan, dengan pencarian, urutan (`sort=popular|price_asc|price_desc`), subkategori, label produk (Panen hari ini / Ikan hidup / Siap masak / UMKM), satuan jual, harga per kg, catatan "berat aktual", dan cerita UMKM. Field-nya ada di tab **D-Sayur** pada form produk Odoo.
- Cart native (`sale.order`), catatan per item untuk petugas, alamat dengan pin peta, login/signup (`auth_signup`), riwayat order, "pesan lagi" (`POST orders/<id>/reorder`) dan saran "Beli lagi" (`GET reorder-suggestions`).
- Checkout: carrier Odoo, slot kirim, preferensi pengganti, kode promo, tukar poin, voucher tier, lalu pembayaran lewat provider Odoo (`GET checkout/payment`, `POST checkout/transaction`). Provider **Transfer / QRIS manual** (`payment_custom`) aktif untuk demo; provider redirect (mis. Xendit) otomatis dipakai bila diaktifkan dan dikonfigurasi di Odoo.
- Status pesanan sesuai riset: Menunggu bayar → Dibayar → **Dipacking** (admin menekan "Mulai packing" di Odoo atau di `/admin/orders`) → Dikirim/Siap diambil (validasi delivery order di Inventory) → Selesai (tombol "Pesanan diterima" atau otomatis 24 jam; pickup diselesaikan admin). Transfer manual dikonfirmasi admin lewat tombol "Konfirmasi pembayaran".
- Member: tier Bronze/Silver/Gold (`GET member`, alias `loyalty`) lengkap dengan progres, tabel benefit, saldo dan riwayat poin. Menu **D-Sayur Operations → Evaluasi Tier (demo)** (dan tombol di `/admin/orders`) menjalankan evaluasi turun-tier tanpa menunggu tanggal 1.
- Cek area kirim publik (`GET area-check?lat=&lng=`) di halaman `/area` dan splash pertama kali.
- Ongkir: carrier **Antar D-Sayur** memakai **OpenRouteService** (jarak jalan, bukan garis lurus), cache jarak per alamat 30 hari, Rp7.000 sampai 3 km lalu Rp2.000/km atau bagiannya, ditolak di atas 20 km. **Ambil sendiri di toko** gratis. Gratis ongkir per tier mengikuti nilai belanja barang.
- Alert restock (`dsayur.stock.alert`) dengan cron Odoo tiap 15 menit; butuh Outgoing Mail Server yang valid.

System Parameters Odoo yang dipakai: `dsayur_headless.api_key`, `dsayur_headless.ors_api_key`, `dsayur_headless.store_latitude`, `dsayur_headless.store_longitude`. Jangan isi koordinat toko berdasarkan perkiraan.

> Catatan Odoo 20: file hak akses addon adalah `security/ir.access.csv` (model `ir.access`, bukan `ir.model.access`), cart diambil lewat `request.cart`, dan `domain` berupa objek `Domain`. Bila memperbarui addon, jalankan `odoo-bin ... -u dsayur_headless` lalu **restart service Odoo (butuh Administrator)** agar kode Python baru aktif.

## Data demo

`odoo/seed/seed_demo.py` mengisi data dummy untuk demo tertutup (idempoten, aman diulang). Semua data contoh: gambar placeholder, harga contoh, UMKM fiktif.

```powershell
& "C:\Program Files\Odoo 20.0.20260930\python\python.exe" "C:\Program Files\Odoo 20.0.20260930\server\odoo-bin" shell -c "C:\Program Files\Odoo 20.0.20260930\server\odoo.conf" -d dsayur --http-port 8093 --max-cron-threads 0 < odoo\seed\seed_demo.py
```

Seed membuat: mata uang IDR (perusahaan dan pricelist), 7 kategori, 64 produk dengan stok, 28 slot kirim (7 hari ke depan), provider Transfer manual, carrier terpublikasi (carrier demo bawaan Odoo diarsipkan), dan akun demo dengan sandi `demo1234`: `bronze@dsayur.demo`, `silver@dsayur.demo`, `gold@dsayur.demo`, serta staf `staff@dsayur.demo` (sales manager, untuk `/admin/*` dan backend Odoo). Ganti sandi ini sebelum demo dibuka di luar jaringan tertutup.

## UI dari riset

Layout mobile-only (kolom maksimal 480 px di tengah layar, bottom navigation, PWA dengan ikon), font Plus Jakarta Sans, splash + cek area kirim, beranda dengan badge tier / Beli lagi / Paket Siap Masak / Produk UMKM, listing dengan filter urutan dan subkategori, detail produk (satuan, per kg, catatan berat aktual, cerita UMKM, kebijakan pengganti), cart dengan catatan per item, checkout, pelacakan status lima tahap, dan halaman member.

Belum diaktifkan atau belum dikerjakan:

- **Xendit** (QRIS/VA/e-wallet): modul `payment_xendit` ada di Odoo 20 tetapi butuh akun merchant sandbox, secret key, dan webhook publik. Setelah provider diaktifkan, checkout langsung memakai alur redirect; kembali dari Xendit masih mendarat di halaman Odoo (`/payment/status`), belum di halaman Next.
- Outgoing Mail Server Odoo (notifikasi restock dan email order).
- Foto produk asli (saat ini placeholder) dan logo/ikon resmi DSayur; ikon PWA saat ini hanya monogram "d".
- Flash sale lebih awal (program promo + `dsayur_minimum_tier` sudah didukung, jadwal dan promo perlu dibuat di Odoo), OTP WhatsApp, wishlist, rating, dan penggantian stok otomatis penuh.
- Deploy staging (`docker-compose`) belum dibuat; proyek ini berjalan lokal di Windows tanpa Docker.
- Pilih kecamatan pada cek area belum ada; cek area memakai lokasi/koordinat.
- Klaim freshness dan rincian loyalti dari riset perlu disahkan sebelum tampil ke pelanggan.

## Keamanan dan pemeriksaan

- BFF meneruskan session Odoo hanya server-side dan tidak meneruskan API key ke browser.
- Route mutasi memeriksa origin; endpoint addon membatasi akses API key dan menggunakan ORM/Odoo website session.
- Endpoint order/admin wajib memeriksa pemilik record dan grup Odoo di backend sebelum dirilis.
- Cart, harga, stok, payment, serta checkout mengambil data fresh dari Odoo (tanpa cache aplikasi).
- Jalankan `npm.cmd run lint`, `npx.cmd tsc --noEmit`, dan `npm.cmd run build`.
- Test addon Odoo 20 dijalankan dengan `--test-enable --test-tags /dsayur_headless`; hasil test pada build lokal `20.0.20260930`: 2 lulus, 0 gagal.

Contoh menjalankan test addon pada instalasi Odoo 20 (gunakan konfigurasi dan executable Odoo setempat):

```powershell
python <path-ke-odoo-20>/odoo-bin -c <path-ke-konfigurasi-odoo20> -d dsayur -u dsayur_headless --test-enable --stop-after-init
```

## Data lama

`dsayur_app` serta scripts/migrasi PostgreSQL lama dibiarkan utuh untuk menjaga data yang sudah ada, tetapi tidak lagi menjadi backend aktif. Jangan jalankan seed lama untuk runtime baru. Migrasi contoh produk ke Odoo harus dilakukan melalui import Odoo terkontrol setelah field, varian, kategori, harga, dan stok dipetakan; jangan menghapus database sumber.
