# Deployment D-Sayur

Target produksi:

- Storefront: `https://dsayur.arusdigital.cloud`
- Panel/backend Odoo: `https://dsayur-odoo.arusdigital.cloud`
- Xendit webhook: `https://dsayur.arusdigital.cloud/payment/xendit/webhook`
- Odoo dipublikasikan melalui HTTPS pada subdomain khusus; port internalnya tetap tidak dibuka langsung ke internet.
- PostgreSQL hanya berada pada jaringan internal Docker.

DNS `dsayur.arusdigital.cloud` saat persiapan ini mengarah ke `72.61.118.220`. Port TCP 80 dan 443 serta UDP 443 harus diizinkan pada firewall/cloud firewall agar Caddy dapat menerbitkan sertifikat HTTPS.

## Mengambil key

### OpenRouteService

1. Masuk ke <https://account.heigit.org/>.
2. Buka tab **API Key**.
3. Salin **Basic Key**. Backend mengirim key ini melalui header `Authorization` ke endpoint `api.heigit.org`.
4. Simpan hanya di `deploy/secrets/ors_api_key` pada server.

### Xendit

1. Masuk ke Xendit Dashboard dan gunakan **Test Mode** terlebih dahulu.
2. Buka **Settings → Developers → API Keys → Generate Secret Key**.
3. Berikan izin **Money-in Write** agar Odoo dapat mengirim pembayaran dan mengajukan refund. Odoo 20 memakai Secret Key; Public Key lama tidak diperlukan oleh hosted redirect flow.
4. Buka **Settings → Webhooks**, ambil **Webhook Verification Token**, dan atur payment webhook URL ke `https://dsayur.arusdigital.cloud/payment/xendit/webhook`.
5. Simpan Secret Key pada `deploy/secrets/xendit_secret_key` dan token pada `deploy/secrets/xendit_webhook_token`.

Gunakan pasangan key dan webhook token dari mode yang sama. Ubah `XENDIT_LIVE_MODE=1` hanya setelah akun dan kanal pembayaran live sudah aktif.

## Instalasi server Ubuntu/Debian

```bash
sudo bash deploy/install-docker.sh
bash deploy/setup-secrets.sh
nano deploy/.env.server
bash deploy/deploy.sh
```

`setup-secrets.sh` membuat password PostgreSQL, master password database Odoo, dan API key internal D-Sayur secara acak. Skrip meminta ORS Basic Key, Xendit Secret Key, dan Xendit Webhook Token tanpa menampilkannya di terminal. Folder `deploy/secrets` dan `deploy/.env.server` diabaikan Git.

Periksa layanan:

```bash
docker compose --env-file deploy/.env.server ps
docker compose --env-file deploy/.env.server logs --tail=100 proxy storefront odoo
curl -I https://dsayur.arusdigital.cloud
```

## Panel Odoo

Buka `https://dsayur-odoo.arusdigital.cloud`. Pastikan DNS subdomain tersebut mengarah ke IP server yang sama. Port Odoo `8069` tetap tidak perlu dibuka pada firewall publik karena akses diteruskan oleh Caddy melalui HTTPS.

## Pembaruan berikutnya

```bash
git pull
bash deploy/deploy.sh
```

Volume `postgres-data` dan `odoo-data` mempertahankan database serta filestore. Backup keduanya sebelum upgrade mayor atau perubahan infrastruktur.
