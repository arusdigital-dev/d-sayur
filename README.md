# D-Sayur

Storefront dan business logic e-commerce berjalan di Next.js. PostgreSQL database `dsayur_app` menyimpan katalog, stok, cart, customer, alamat, kupon, dan order aplikasi. Odoo tidak dibutuhkan atau dipanggil oleh runtime aplikasi.

## Menjalankan di Windows (tanpa Docker)

Persyaratan: Node.js 20.9+, npm, dan PostgreSQL lokal (service yang digunakan saat ini: `postgresql-x64-16`).

1. Pastikan PostgreSQL berjalan.
2. Salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL` yang dapat mengakses database `dsayur_app`. Jangan gunakan prefix `NEXT_PUBLIC_` untuk kredensial.
3. Siapkan schema dan akun admin:

   ```powershell
   npm.cmd install
   npm.cmd run db:setup
   ```

4. Isi katalog demo awal (aman dijalankan ulang; tidak mengubah produk yang sudah ada):

   ```powershell
   npm.cmd run db:seed-products
   ```

5. Jalankan aplikasi:

   ```powershell
   npm.cmd run dev:all
   ```

   Atau `npm.cmd run dev` jika PostgreSQL dan schema sudah siap. Buka <http://localhost:3000>. Hentikan Next.js dengan `Ctrl+C`; PostgreSQL tetap berjalan.

`dev:all` memastikan service PostgreSQL hidup, menjalankan setup schema yang aman untuk diulang, lalu menjalankan Next.js. Untuk production, buat role PostgreSQL khusus aplikasi dengan hak minimum pada database ini dan gunakan password kuat.

## Akun admin awal

Setup membuat admin:

- Email: `admin@example.com`
- Password awal: nilai `INITIAL_ADMIN_PASSWORD` di `.env.local` (default development: `admin`)

Ganti password awal sebelum dipakai di jaringan publik. Masuk melalui `/login`, lalu buka **Kelola toko** atau kunjungi `/admin/products`. Area admin menyediakan pengelolaan produk/kategori dan `/admin/orders` untuk status pesanan.

## Arsitektur

```text
Browser → Next.js App Router (UI + server API) → PostgreSQL dsayur_app
```

Next.js menyediakan UI, routing, rendering, autentikasi, validasi request, dan API internal same-origin. `src/lib/db.ts` mengelola koneksi PostgreSQL; `src/lib/storefront.ts` dan `src/lib/account-data.ts` membaca data untuk halaman server; `src/app/api/store/[...path]/route.ts` mengelola aksi storefront dan admin dalam transaksi/SQL berparameter. Password disimpan dengan scrypt; cookie sesi bersifat HttpOnly, SameSite=Lax, dan token sesi disimpan dalam bentuk hash.

PostgreSQL adalah sumber data aplikasi, bukan Odoo. Harga, pajak, ongkir, stok, kupon, dan status order saat ini merupakan aturan aplikasi Next.js/DB dan belum merupakan integrasi ke engine Odoo. Pembayaran yang tersedia pada implementasi awal adalah Cash on Delivery; gateway online belum dikonfigurasi.

## Fitur dan route

- `/` storefront
- `/products`, `/products/[slug]`, `/categories/[slug]` katalog dan detail produk/varian
- `/cart`, `/checkout` cart persisten dan checkout COD
- `/login`, `/register`, `/account`, `/account/orders`, `/account/orders/[id]`
- `/admin/products` tambah/edit produk dan kategori
- `/admin/orders` daftar pesanan dan transisi status

Data bisnis tidak disimpan di state browser sebagai source of truth. UI meminta snapshot terbaru ke server; seluruh mutasi melewati API aplikasi, memeriksa session/ownership/role, lalu menyimpan di PostgreSQL. Harga final checkout dan pengurangan stok dilakukan server-side dengan transaksi dan row lock; browser hanya menampilkan hasil.

## Konfigurasi

`.env.local` (jangan commit):

```dotenv
DATABASE_URL=postgresql://<role>:<password>@localhost:5432/dsayur_app
INITIAL_ADMIN_PASSWORD=<password-awal-admin>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Database harus sudah dibuat sebelum `db:setup`. Variabel `DATABASE_URL` hanya dibaca server-side. `INITIAL_ADMIN_PASSWORD` hanya dipakai saat akun admin awal belum ada; mengubahnya setelah seed tidak mengganti password akun yang sudah dibuat.

## Pengembangan dan deployment

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Untuk deployment, gunakan PostgreSQL terkelola atau PostgreSQL milik sendiri, role khusus least-privilege, HTTPS, secret yang kuat, backup dan pemantauan, serta set `NEXT_PUBLIC_SITE_URL` ke domain storefront. Jangan expose port database ke publik. Migrasi schema berada di `db/migrations`; `npm.cmd run db:setup` menerapkan schema dan seed awal.

## Batasan implementasi saat ini

Admin saat ini mendukung produk sederhana dengan satu varian stok default; gateway pembayaran online, pengiriman kurir terintegrasi, pajak kompleks, promosi lanjutan, upload gambar, dan pengelolaan banyak varian perlu ditambahkan sebelum penggunaan production. Produk katalog awal memakai harga dan stok contoh—sesuaikan melalui panel admin sebelum menerima pesanan nyata.
