import Link from "next/link";
import { CartCount } from "@/components/cart/cart-count";

export function SiteHeader() {
  return <>
    <div className="announcement">PROTOTYPE · BELANJA KEBUTUHAN HARIAN <span>✦</span> TANJUNGPINANG</div>
    <header className="site-header">
      <Link className="brand" href="/home" aria-label="D-Sayur beranda"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link>
      <nav className="main-nav" aria-label="Navigasi utama"><Link href="/products">Semua produk</Link><Link href="/categories">Kategori</Link><Link href="/account/orders">Pesanan</Link></nav>
      <div className="header-actions"><Link className="account-link" href="/account">Akun</Link><CartCount /></div>
    </header>
  </>;
}

export function SiteFooter() {
  return <footer className="site-footer"><Link className="brand" href="/home"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link><span>Segar dari pilihan lokal.</span><span>© 2026 D-Sayur · Prototype</span></footer>;
}
