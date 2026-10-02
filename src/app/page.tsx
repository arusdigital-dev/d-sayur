import Link from "next/link";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { getReorderSuggestions } from "@/lib/odoo/products";
import { customerCookie } from "@/lib/odoo/customer";
import { getCustomer, getLoyalty } from "@/lib/account-data";
import { categoryIcon } from "@/lib/category-icon";
import { ProductGrid } from "@/components/product/product-grid";

export default async function Home() {
  await connection();
  const session = await getCustomer();
  const [categories, products, reorder, loyalty] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ limit: 4, sort: "popular" }).catch(() => ({ items: [], page: 1, limit: 4, total: 0 })),
    session.logged_in ? customerCookie().then(getReorderSuggestions) : Promise.resolve([]),
    session.logged_in ? getLoyalty() : Promise.resolve(null),
  ]);
  const curatedGroups = [
    { title: "Paket siap masak", terms: ["siap masak", "paket masak", "meal kit"] },
    { title: "Produk UMKM lokal", terms: ["umkm", "produk lokal", "lokal"] },
  ];

  return <main>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span /> BELANJA LOKAL, LEBIH PRAKTIS</div><h1>Baik dari alam,<br />untuk <em>rumah.</em></h1><p>Temukan kebutuhan pangan harian, produk lokal, dan inspirasi masak dari katalog D-Sayur.</p><form className="home-search" action="/products"><label htmlFor="home-search">Cari produk</label><div><input id="home-search" name="search" placeholder="Cari sayur, buah, lauk…" /><button aria-label="Cari">⌕</button></div></form><Link className="primary-button" href="/products">Mulai belanja <span>↗</span></Link><div className="hero-note"><span className="note-stars">✳ ✳ ✳</span><span>Prototype storefront<br />untuk Tanjungpinang.</span></div></div>
      <div className="hero-art" aria-label="Ilustrasi hasil bumi segar" role="img"><div className="sun-disc" /><div className="art-caption">PILIHAN<br />HARIAN</div><div className="leaf leaf-one">❧</div><div className="leaf leaf-two">❧</div><div className="produce produce-orange" /><div className="produce produce-green" /><div className="produce produce-cream" /><div className="art-ground" /><div className="art-label">DSAYUR · PROTOTYPE <span>✳</span></div></div>
      <div className="hero-index">01 <span /> 03</div>
    </section>
    {loyalty && <div className="quick-row" style={{ marginTop: 14 }}><Link className={`tier-pill ${loyalty.tier}`} href="/account">★ Member {loyalty.tier.toUpperCase()} · {loyalty.points_multiplier}× poin</Link></div>}
    <div className="quick-row"><Link className="quick-card" href="/area"><span aria-hidden="true">📍</span><div><b>Cek area kirim</b>Ongkir dari jarak rute</div></Link><Link className="quick-card" href="/products?sort=popular"><span aria-hidden="true">🔥</span><div><b>Terlaris</b>Pilihan favorit pembeli</div></Link></div>
    <section className="promise-strip" aria-label="Informasi prototype"><span>✳ &nbsp; Katalog dikelola di Odoo</span><i>·</i><span>✳ &nbsp; Toko demo Tanjungpinang</span></section>
    {reorder.length > 0 && <section className="collections"><div className="section-heading"><div><div className="eyebrow"><span /> DARI PESANAN SEBELUMNYA</div><h2>Beli <em>lagi.</em></h2></div><Link href="/account/orders" className="text-link">Riwayat <span>↗</span></Link></div><ProductGrid products={reorder.slice(0, 4)} /></section>}
    <section className="collections"><div className="section-heading"><div><div className="eyebrow"><span /> DARI KATALOG ODOO</div><h2>Belanja <em>hari ini.</em></h2></div><Link href="/products" className="text-link">Semua produk <span>↗</span></Link></div>{products.items.length ? <ProductGrid products={products.items} /> : <div className="catalog-empty"><h2>Katalog sedang disiapkan.</h2><p>Produk akan tampil setelah katalog dipublikasikan di Odoo.</p></div>}</section>
    {categories.length > 0 && <section className="collections"><div className="section-heading"><div><div className="eyebrow"><span /> PILIH KATEGORI</div><h2>Yang kamu <em>butuhkan.</em></h2></div><Link href="/categories" className="text-link">Semua kategori <span>↗</span></Link></div><div className="collection-grid">{categories.slice(0, 4).map((category, index) => <Link href={`/categories/${category.slug}`} className="collection-card" key={category.id}><div className="collection-top"><span>{String(index + 1).padStart(2, "0")} / {String(Math.min(categories.length, 4)).padStart(2, "0")}</span><span className="collection-icon">{categoryIcon(category.name)}</span></div><div><h3>{category.name}</h3><p>Lihat pilihan yang tersedia.</p></div><span className="card-arrow">↗</span></Link>)}</div></section>}
    {await Promise.all(curatedGroups.map(async (group) => {
      const matching = categories.filter((category) => group.terms.some((term) => category.name.toLocaleLowerCase("id-ID").includes(term)));
      if (!matching.length) return null;
      const results = await Promise.all(matching.map((category) => getProducts({ categorySlug: category.slug, limit: 4 }).catch(() => null)));
      const items = results.flatMap((result) => result?.items ?? []).slice(0, 4);
      if (!items.length) return null;
      return <section className="collections" key={group.title}><div className="section-heading"><div><div className="eyebrow"><span /> PILIHAN DARI KATALOG ODOO</div><h2>{group.title}</h2></div><Link href={`/categories/${matching[0].slug}`} className="text-link">Lihat koleksi <span>↗</span></Link></div><ProductGrid products={items} /></section>;
    }))}
  </main>;
}
