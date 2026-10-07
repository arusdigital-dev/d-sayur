import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { getCustomer, getHomeAddress, getLoyalty } from "@/lib/account-data";
import { PromoCarousel } from "@/components/home/promo-carousel";
import { HomeAddressPicker } from "@/components/home/home-address-picker";
import { HomeCategoryProducts } from "@/components/home/home-category-products";

export default async function StoreHome({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await connection();
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [session, categories, products] = await Promise.all([
    getCustomer(),
    getCategories().catch(() => []),
    getProducts({ page: requestedPage, limit: 12, sort: "popular" }).catch(() => ({ items: [], page: requestedPage, limit: 12, total: 0 })),
  ]);
  const [loyalty, homeDelivery] = session.logged_in ? await Promise.all([getLoyalty(), getHomeAddress()]) : [null, null];

  return <main className="ds-home">
    <header className="ds-home-header">
      <HomeAddressPicker initialAddress={homeDelivery?.address ?? null} initialBranch={homeDelivery?.branch ?? null} initialEta={homeDelivery?.eta ?? null} loggedIn={session.logged_in} />
      <Link className="ds-points" href={session.logged_in ? "/account" : "/login"}><span className="ds-points-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20v-7m0 3c-4.4 0-7-2.5-7-6 4.3 0 7 2.1 7 6Zm0-4c0-4 2.5-6.5 7-6.5 0 4.5-2.6 6.5-7 6.5Z"/><path d="M8.5 20h7"/></svg></span><span className="ds-points-count">{session.logged_in ? `${(loyalty?.cards.reduce((sum, card) => sum + card.points, 0) ?? 0).toLocaleString("id-ID")} Poin` : "Daftar / Masuk"}</span></Link>
    </header>

    <form className="ds-search" action="/products"><span aria-hidden="true">⌕</span><input name="search" aria-label="Cari produk" placeholder="Cari sayur, buah atau bumbu..." /><button aria-label="Cari">Cari</button></form>

    <PromoCarousel count={3}>
      <Link className="ds-promo-card ds-promo-green" href="/products"><Image src="/figma/promo-weekend.png" alt="Sayuran segar untuk pilihan harian" fill sizes="338px" /><span className="ds-promo-label">PILIHAN SEGAR</span><strong>Sayur segar<br />setiap hari</strong><span className="ds-promo-cta">Lihat produk →</span></Link>
      <Link className="ds-promo-card ds-promo-peach" href="/products"><Image src="/figma/promo-local.jpg" alt="Aneka sayur dan buah segar" fill sizes="338px" priority /><span className="ds-promo-label">PROMO AKHIR PEKAN</span><strong>Cuma di hari<br />Sabtu &amp; Minggu</strong><span className="ds-discount">30%</span><span className="ds-promo-cta">Belanja Sekarang</span></Link>
      <Link className="ds-promo-card ds-promo-yellow" href="/categories"><Image src="/figma/promo-fresh.png" alt="Pasar sayur dan buah" fill sizes="338px" /><span className="ds-promo-label">DARI PETANI LOKAL</span><strong>Segar setiap<br />hari untukmu</strong><span className="ds-promo-cta">Lihat produk →</span></Link>
    </PromoCarousel>

    <HomeCategoryProducts categories={categories} initialListing={products} />
  </main>;
}
