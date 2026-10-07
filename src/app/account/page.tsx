import type { Metadata } from "next";
import Link from "next/link";
import { getCustomer } from "@/lib/account-data";
import { LogoutButton } from "@/components/account/logout-button";
import { LoyaltyPanel } from "@/components/account/loyalty-panel";
import { ProfileEditor } from "@/components/account/profile-editor";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Akun saya" };

export default async function AccountPage() {
  const result = await getCustomer();
  const customer = result?.customer;
  if (!result?.logged_in || !customer) return <main className="account-page account-empty"><section className="account-empty-card"><div className="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="21" r="11"/><path d="M11 55c1.8-11.2 9.5-17 21-17s19.2 5.8 21 17"/><path d="M45 11c5-5 11-4 12-3-1 7-5 11-12 11"/></svg></div><p className="auth-kicker">AKUN D-SAYUR</p><h1>Masuk untuk membuka akun</h1><p>Lihat pesanan, kelola alamat pengiriman, dan nikmati manfaat member D-Sayur.</p><div className="account-empty-actions"><Link href="/login" className="primary-button">Masuk <span>→</span></Link><Link href="/register" className="secondary-button">Buat akun</Link></div><small>Belum menjadi member? Buat akun hanya dalam beberapa langkah.</small></section></main>;
  const initials = customer.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <main className="account-page ds-account">
    <header className="ds-account-profile"><div className="ds-account-avatar" aria-hidden="true">{initials}</div><div><h1>{customer.name}</h1><p>Member D-Sayur · {customer.email}</p></div></header>
    <LoyaltyPanel compact />
    <section className="ds-account-section"><h2>Akun</h2><div className="ds-account-menu">
      <details><summary><span className="ds-account-icon">♙</span><span>Kelola profil<small>Nama, email, dan nomor telepon</small></span><b>›</b></summary><ProfileEditor /></details>
      <details><summary><span className="ds-account-icon">♙</span><span>Kata sandi &amp; keamanan<small>Keamanan sesi akun</small></span><b>›</b></summary><div className="ds-account-note"><p>Jangan lupa keluar jika perangkat digunakan bersama.</p><LogoutButton /></div></details>
      <details><summary><span className="ds-account-icon">♧</span><span>Pengaturan Notifikasi<small>Pengingat saat stok tersedia</small></span><b>›</b></summary><div className="ds-account-note"><p>Aktifkan pengingat stok dari halaman produk yang sedang kosong.</p><Link href="/products">Jelajahi produk</Link></div></details>
      <details><summary><span className="ds-account-icon">⌖</span><span>Alamat pengiriman<small>Atur alamat dan pin lokasi</small></span><b>›</b></summary><AddressBook /></details>
      {customer.is_admin && <Link href="/admin/products"><span className="ds-account-icon">⚙</span><span>Kelola toko<small>Produk, stok, kategori, pesanan</small></span><b>›</b></Link>}
    </div></section>
    <section className="ds-account-section ds-account-preferences"><h2>Preferensi</h2><div className="ds-account-menu"><Link href="/account/orders"><span className="ds-account-icon">▤</span><span>Pesanan saya<small>Lihat status dan riwayat pesanan</small></span><b>›</b></Link><Link href="/account/help"><span className="ds-account-icon">?</span><span>Pusat Bantuan<small>Jawaban untuk pesanan, pembayaran, dan alamat</small></span><b>›</b></Link><div className="ds-account-logout"><LogoutButton /></div></div></section>
  </main>;
}
