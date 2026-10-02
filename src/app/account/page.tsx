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
  if (!result?.logged_in || !customer) return <main className="catalog-empty account-empty"><h1>Masuk untuk membuka akun.</h1><p>Profil dan data pelanggan dikelola oleh D-Sayur.</p><Link href="/login" className="primary-button">Masuk <span>↗</span></Link></main>;
  return <main className="account-page">
    <div className="catalog-heading"><div className="eyebrow"><span /> AKUN D-SAYUR</div><h1>Halo, <em>{customer.name.split(" ")[0]}.</em></h1><p>{customer.email}</p></div>
    <LoyaltyPanel />
    <ProfileEditor />
    <AddressBook />
    <div className="account-links"><Link href="/products"><span>01</span><strong>Belanja produk</strong><b>↗</b></Link><Link href="/categories"><span>02</span><strong>Kategori produk</strong><b>↗</b></Link><Link href="/cart"><span>03</span><strong>Keranjang</strong><b>↗</b></Link><Link href="/account/orders"><span>04</span><strong>Riwayat pesanan</strong><b>↗</b></Link>{customer.is_admin && <Link href="/admin/products"><span>05</span><strong>Kelola toko <small>produk, stok, kategori, pesanan</small></strong><b>↗</b></Link>}<LogoutButton /></div>
  </main>;
}
