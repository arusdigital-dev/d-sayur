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
  if (!result?.logged_in || !customer) return <main className="catalog-empty account-empty"><h1>Masuk untuk membuka akun.</h1><p>Profil dan data pelanggan dikelola oleh D-Sayur.</p><Link href="/login" className="primary-button">Masuk <span>→</span></Link></main>;
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
    <section className="ds-account-section ds-account-preferences"><h2>Preferensi</h2><div className="ds-account-menu"><Link href="/account/orders"><span className="ds-account-icon">▤</span><span>Pesanan saya<small>Lihat status dan riwayat pesanan</small></span><b>›</b></Link><div className="ds-account-logout"><LogoutButton /></div></div></section>
  </main>;
}
