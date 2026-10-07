import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pusat Bantuan" };

const topics = [
  { title: "Pembayaran berhasil, tetapi pesanan belum terlihat", text: "Buka Pesanan Saya lalu muat ulang halaman. Status pembayaran yang sudah berhasil akan ditautkan ke pesanan setelah konfirmasi dari penyedia pembayaran.", href: "/account/orders", link: "Periksa pesanan" },
  { title: "Alamat pengantaran tidak sesuai", text: "Atur alamat utama dan pin lokasi dari menu Akun → Alamat pengiriman. Saat checkout, alamat utama akan terpilih otomatis dan detailnya bisa diperiksa sebelum membayar.", href: "/account", link: "Kelola alamat" },
  { title: "Bagaimana pembatalan pesanan?", text: "Buka detail pesanan dan ajukan pembatalan sebelum pesanan mulai disiapkan. Tim toko akan meninjau permintaan dan status pembayaran. Pengembalian dana, jika ada, diproses setelah pemeriksaan.", href: "/account/orders", link: "Lihat status pesanan" },
  { title: "Produk atau jumlah pesanan perlu diubah", text: "Perubahan keranjang dilakukan sebelum pembayaran. Setelah pesanan dibayar, perubahan perlu ditangani sebagai permintaan bantuan agar jumlah dan pembayaran tetap cocok.", href: "/checkout", link: "Kembali ke checkout" },
];

export default function HelpCenterPage() {
  return <main className="account-page help-center-page">
    <div className="catalog-heading"><div className="eyebrow"><span /> BANTUAN D-SAYUR</div><h1>Pusat <em>Bantuan.</em></h1><p>Pilih topik untuk menemukan langkah yang bisa dilakukan.</p></div>
    <div className="help-center-list">{topics.map((topic) => <article key={topic.title}><div><h2>{topic.title}</h2><p>{topic.text}</p></div><Link href={topic.href}>{topic.link} <span aria-hidden="true">↗</span></Link></article>)}</div>
    <Link className="text-link" href="/account">← Kembali ke akun</Link>
  </main>;
}
