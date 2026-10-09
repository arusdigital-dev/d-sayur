import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/storefront";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { BadgeLabel, PriceMeta } from "@/components/product/product-meta";
import { ProductGallery } from "@/components/product/product-gallery";
import { BackButton } from "@/components/product/back-button";
import { ProductSocialActions } from "@/components/product/product-social-actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produk tidak ditemukan", robots: { index: false } };
  const description = product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `/products/${product.slug}`;
  return { title: product.name, description: description || `Lihat ${product.name} di D-Sayur.`, alternates: { canonical: url }, openGraph: { type: "website", title: product.name, description: description || `Lihat ${product.name} di D-Sayur.`, url, images: [storefrontProductPhoto(product)] } };
}

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  await connection();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await getProduct(slug);
  if (!product) notFound();
  const photo = storefrontProductPhoto(product);
  const structuredData = {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), image: [photo],
    offers: { "@type": "Offer", priceCurrency: product.price.currency, price: product.price.amount, availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: new URL(`/products/${product.slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString() },
  };
  return <main className="product-detail"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <header className="detail-page-header"><BackButton iconOnly returnTo={query.returnTo} /><strong>Detail Produk</strong><span aria-hidden="true" /></header>
    <div className="detail-gallery-column"><ProductGallery images={product.images} fallbackPhoto={photo} fallbackAlt={product.name} /></div>
    <div className="detail-copy">
      <div className="detail-title-row"><div><BadgeLabel product={product} /><h1>{product.name}</h1></div><ProductSocialActions name={product.name} /></div>
      <PriceMeta product={product} withNote />
      <AddToCartButton product={product} />
      <section className="detail-description-block"><h2>Deskripsi</h2><p className="detail-description">{product.description}</p></section>
      {product.umkm && <aside className="umkm-story" aria-label="Cerita UMKM"><small>CERITA UMKM</small><h2>{product.umkm.name}</h2>{product.umkm.origin && <p className="umkm-origin">📍 {product.umkm.origin}</p>}{product.umkm.story && <p>{product.umkm.story}</p>}</aside>}
      <ul className="trust-list"><li>✓ Barang kosong? Kami hubungi atau ganti produk sejenis sesuai pilihan Anda saat checkout.</li><li>✓ Tidak segar? Ajukan tukar saat barang diterima.</li></ul><p className="stock-note">Ketersediaan, varian, dan harga diperiksa ulang saat menambahkan ke keranjang dan checkout.</p>
    </div>
  </main>;
}
