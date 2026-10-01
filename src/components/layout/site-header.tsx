import Link from "next/link";
import { CartCount } from "@/components/cart/cart-count";

export function SiteHeader() {
  return <><div className="announcement">Belanja lebih dekat dengan alam <span>✳</span> Pilihan segar setiap hari</div><header className="site-header"><Link className="brand" href="/" aria-label="D-Sayur beranda"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link><nav className="main-nav" aria-label="Navigasi utama"><Link href="/products">Semua produk</Link><Link href="/categories">Kategori</Link><Link href="/account/orders">Pesanan</Link></nav><div className="header-actions"><Link className="account-link" href="/account">Akun</Link><CartCount /></div></header></>;
}

export function SiteFooter() {
  return <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link><span>Baik dari alam, baik untuk kita.</span><span>© 2026 D-Sayur</span></footer>;
}
