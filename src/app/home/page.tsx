import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { getCustomer, getHomeAddress, getLoyalty } from "@/lib/account-data";
import { categoryImage } from "@/lib/category-image";
import { ProductGrid } from "@/components/product/product-grid";
import { PromoCarousel } from "@/components/home/promo-carousel";

export default async function StoreHome() {
  await connection();
  const [session, categories, products] = await Promise.all([
    getCustomer(),
    getCategories().catch(() => []),
    getProducts({ limit: 12, sort: "popular" }).catch(() => ({ items: [], page: 1, limit: 12, total: 0 })),
  ]);
  const [loyalty, homeAddress] = session.logged_in ? await Promise.all([getLoyalty(), getHomeAddress()]) : [null, null];

  return <main className="ds-home">
    <header className="ds-home-header">
      <Link className="ds-location" href={session.logged_in ? "/account" : "/login?next=%2Faccount"}><span className="ds-pin" aria-hidden="true">⌖</span><span><small>Antar ke</small><strong>{homeAddress?.street || "Pilih alamat"} <i>⌄</i></strong><small>{homeAddress ? [homeAddress.name, homeAddress.street2, homeAddress.city, homeAddress.zip].filter(Boolean).join(", ") : "Atur alamat pengiriman"}</small></span></Link>
      <Link className="ds-points" href={session.logged_in ? "/account" : "/login"}><span aria-hidden="true">✦</span><span><small>{session.logged_in ? "Poin kamu" : "Gabung member"}</small><strong>{session.logged_in ? `${loyalty?.cards.reduce((sum, card) => sum + card.points, 0) ?? 0} Poin` : "Daftar / Masuk"}</strong></span></Link>
    </header>

    <form className="ds-search" action="/products"><span aria-hidden="true">⌕</span><input name="search" aria-label="Cari produk" placeholder="Cari sayur, buah atau bumbu..." /><button aria-label="Cari">Cari</button></form>

    <PromoCarousel count={3}>
      <Link className="ds-promo-card ds-promo-green" href="/products"><Image src="/figma/promo-weekend.png" alt="Sayuran segar untuk pilihan harian" fill sizes="338px" /><span className="ds-promo-label">PILIHAN SEGAR</span><strong>Sayur segar<br />setiap hari</strong><span className="ds-promo-cta">Lihat produk →</span></Link>
      <Link className="ds-promo-card ds-promo-peach" href="/products"><Image src="/figma/promo-local.jpg" alt="Aneka sayur dan buah segar" fill sizes="338px" priority /><span className="ds-promo-label">PROMO AKHIR PEKAN</span><strong>Cuma di hari<br />Sabtu &amp; Minggu</strong><span className="ds-discount">30%</span><span className="ds-promo-cta">Belanja Sekarang</span></Link>
      <Link className="ds-promo-card ds-promo-yellow" href="/categories"><Image src="/figma/promo-fresh.png" alt="Pasar sayur dan buah" fill sizes="338px" /><span className="ds-promo-label">DARI PETANI LOKAL</span><strong>Segar setiap<br />hari untukmu</strong><span className="ds-promo-cta">Lihat produk →</span></Link>
    </PromoCarousel>

    <section className="ds-section ds-categories"><div className="ds-section-head"><h2>Kategori</h2><Link href="/categories">Lihat semua <span>→</span></Link></div><div className="ds-category-list">
      {categories.slice(0, 8).map((category) => <Link className="ds-category" href={`/categories/${category.slug}`} key={category.id}><Image className="ds-category-image" unoptimized src={category.image?.includes("/api/odoo-image/") ? categoryImage(category.name) : category.image || categoryImage(category.name)} alt="" width={24} height={24} /><span>{category.name}</span></Link>)}
      {!categories.length && <Link className="ds-category" href="/categories"><Image className="ds-category-image" src="/figma/category-vegetables.png" alt="" width={24} height={24} /><span>Sayuran</span></Link>}
    </div></section>

    <section className="ds-section ds-products"><div className="ds-section-head"><h2>Segar untuk hari ini</h2><Link href="/products">Lihat semua <span>→</span></Link></div>{products.items.length ? <ProductGrid products={products.items} /> : <div className="catalog-empty"><h2>Produk segar sedang disiapkan</h2><p>Produk yang dipublikasikan akan tampil di sini.</p></div>}</section>
  </main>;
}
