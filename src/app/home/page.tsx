import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { HomeAddressPicker } from "@/components/home/home-address-picker";
import { SpecialCarousel } from "@/components/home/special-carousel";
import { ProductGrid } from "@/components/product/product-grid";
import { CartBadge } from "@/components/cart/cart-count";
import { getCategories, getProducts } from "@/lib/storefront";
import { getCustomer, getHomeAddress } from "@/lib/account-data";
import { findHomeCategory, homeAssets } from "@/config/home-assets";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Belanja segar setiap hari",
  description: "Sayur, buah, dan kebutuhan dapur segar dari D'Sayur.",
};

const categoryCards = [
  { title: "Serba Promo", key: "promo", terms: ["promo", "diskon"], href: "/products?filter=discount" },
  { title: "Siap Masak", key: "readyToCook", terms: ["siap masak", "ready to cook"], href: "" },
  { title: "Aneka Bumbu", key: "spices", terms: ["bumbu", "rempah"], href: "" },
  { title: "Produk Beku", key: "frozen", terms: ["beku", "frozen"], href: "" },
] as const;

export default async function StoreHome() {
  await connection();
  const [session, categories, deals, popular] = await Promise.all([
    getCustomer(),
    getCategories().catch(() => []),
    getProducts({ filter: "discount", sort: "popular", page: 1, limit: 4 }).catch(() => ({ items: [], page: 1, limit: 4, total: 0 })),
    getProducts({ sort: "popular", page: 1, limit: 8 }).catch(() => ({ items: [], page: 1, limit: 8, total: 0 })),
  ]);
  const homeDelivery = session.logged_in ? await getHomeAddress() : null;

  return <main className={`${styles.home} ds-home`}>
    <header className={`${styles.header} ds-home-header`}>
      <HomeAddressPicker initialAddress={homeDelivery?.address ?? null} initialBranch={homeDelivery?.branch ?? null} initialEta={homeDelivery?.eta ?? null} loggedIn={session.logged_in} />
      <Link className={styles.cartLink} href="/cart" aria-label="Buka keranjang"><Image src={homeAssets.icons.cart} alt="" width={24} height={24} /><CartBadge className={styles.badge} /></Link>
    </header>

    <Link className={styles.weekendBanner} href="/products?filter=discount" aria-label="Lihat promo akhir pekan">
      <Image src={homeAssets.weekendBanner} alt="Pilihan sayur segar di pasar" fill priority sizes="(max-width: 520px) 100vw, 520px" />
      <span className={styles.bannerShade} />
      <span className={styles.bannerContent}><small>{deals.total > 0 ? "PROMO AKTIF DARI D’SAYUR" : "SEGAR UNTUK AKHIR PEKAN"}</small><strong>{deals.total > 0 ? "Diskon hari ini" : "Sabtu & Minggu"}</strong><span>{deals.total > 0 ? `${deals.total} produk sedang mendapat harga promo.` : "Temukan pilihan segar untuk meja makanmu"}</span><b>{deals.total > 0 ? "Lihat promo" : "Belanja sekarang"} <span aria-hidden="true">→</span></b></span>
      <span className={styles.bannerDots} aria-hidden="true"><i /><i /><i /></span>
    </Link>

    <form className={styles.search} action="/products" role="search">
      <Image src={homeAssets.icons.search} alt="" width={24} height={24} />
      <input name="search" aria-label="Cari produk" placeholder="Cari sayur, buah, dan lainnya" />
      <button type="submit">Cari</button>
    </form>

    <section className={styles.categories} aria-labelledby="home-categories-title">
      <div className={styles.sectionHeading}><h2 id="home-categories-title">Belanja berdasarkan kategori</h2><Link href="/categories">Lihat semua</Link></div>
      <div className={styles.categoryRow}>{categoryCards.map((item) => {
        const category = findHomeCategory(categories, [...item.terms]);
        const href = item.href || (category ? `/categories?categorySlug=${encodeURIComponent(category.slug)}` : "/categories");
        return <Link className={styles.categoryCard} href={href} key={item.key}>
          <span className={styles.categoryImage}><Image src={homeAssets.categories[item.key]} alt="" fill sizes="72px" /></span>
          <span>{item.title}</span>
        </Link>;
      })}</div>
    </section>

    <section className={styles.productSection} aria-labelledby="home-deals-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PILIHAN HARI INI</p><h2 id="home-deals-title">Diskon untuk hari ini</h2></div><Link href="/products?filter=discount">Lihat semua</Link></div>
      {deals.items.length ? <ProductGrid products={deals.items} quickAdd returnTo="/home" className={styles.productGrid} showAvailability={false} showStockQuantity={false} /> : <div className={styles.emptyDeals}><span>Promo baru segera hadir</span><Link href="/products">Jelajahi produk</Link></div>}
    </section>

    <section className={styles.voucher} aria-label="Voucher pembelian pertama">
      <span className={styles.voucherIcon}><Image src={homeAssets.icons.discount} alt="" width={48} height={48} /></span>
      <span className={styles.voucherCopy}><small>KHUSUS PELANGGAN BARU</small><strong>Voucher pembelian pertama</strong><span>Penawaran dapat dilihat saat checkout.</span></span>
      <Link href={session.logged_in ? "/cart" : "/login?next=%2Fcart"}>Klaim</Link>
    </section>

    <Link className={styles.membership} href={session.logged_in ? "/account" : "/login?next=%2Faccount"}>
      <Image className={styles.memberGlow} src={homeAssets.membershipGlow} alt="" width={602} height={602} />
      <span className={styles.memberBrand} aria-hidden="true"><Image src={homeAssets.membershipLogo} alt="" width={44} height={44} /></span>
      <span className={styles.memberCopy}><strong>Dapatkan Keuntungan</strong><span>Jadilah member dan kumpulkan poin nikmati lebih banyak keuntungan.</span><b>Lihat benefit dan poin</b></span>
      <Image className={styles.memberMascot} src={homeAssets.membershipMascot} alt="Ilustrasi maskot D'Sayur" width={145} height={219} />
    </Link>

    <section className={styles.special} aria-labelledby="home-special-title">
      <div className={styles.sectionHeading}><h2 id="home-special-title">Special untuk kamu</h2></div>
      <SpecialCarousel />
    </section>

    <section className={styles.productSection} aria-labelledby="home-fresh-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PILIHAN SEGAR</p><h2 id="home-fresh-title">Segar untuk hari ini</h2></div><Link href="/products?sort=popular">Lihat semua</Link></div>
      {popular.items.length ? <ProductGrid products={popular.items} quickAdd returnTo="/home" className={styles.productGrid} showAvailability={false} showStockQuantity={false} /> : <div className={styles.emptyDeals}><span>Produk belum tersedia.</span><Link href="/products">Coba lagi</Link></div>}
    </section>

    <p className={styles.promoNote}>Informasi voucher dan paket pilihan di Home merupakan konten tampilan. Promo, harga, stok, dan keranjang tetap mengikuti data Odoo.</p>
  </main>;
}
