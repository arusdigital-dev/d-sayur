import type { Metadata } from "next";
import { connection } from "next/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/storefront";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { BadgeLabel, PriceMeta } from "@/components/product/product-meta";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produk tidak ditemukan", robots: { index: false } };
  const description = product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `/products/${product.slug}`;
  return { title: product.name, description: description || `Lihat ${product.name} di D-Sayur.`, alternates: { canonical: url }, openGraph: { type: "website", title: product.name, description: description || `Lihat ${product.name} di D-Sayur.`, url, images: [storefrontProductPhoto(product)] } };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const photo = storefrontProductPhoto(product);
  const structuredData = {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), image: [photo],
    offers: { "@type": "Offer", priceCurrency: product.price.currency, price: product.price.amount, availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: new URL(`/products/${product.slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString() },
  };
  return <main className="product-detail"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><div className="detail-image"><Image unoptimized fill sizes="(max-width: 850px) 86vw, 40vw" src={photo} alt={product.images[0]?.alt ?? product.name} /></div><div className="detail-copy"><div className="eyebrow"><span /> PILIHAN D-SAYUR</div><BadgeLabel product={product} /><h1>{product.name}</h1><PriceMeta product={product} withNote /><p className="detail-description">{product.description}</p>{product.umkm && <aside className="umkm-story" aria-label="Cerita UMKM"><small>CERITA UMKM</small><h2>{product.umkm.name}</h2>{product.umkm.origin && <p className="umkm-origin">📍 {product.umkm.origin}</p>}{product.umkm.story && <p>{product.umkm.story}</p>}</aside>}<AddToCartButton product={product} /><ul className="trust-list"><li>✓ Barang kosong? Kami hubungi atau ganti produk sejenis sesuai pilihan Anda saat checkout.</li><li>✓ Tidak segar? Ajukan tukar saat barang diterima.</li></ul><p className="stock-note">Ketersediaan, varian, dan harga diperiksa ulang saat menambahkan ke keranjang dan checkout.</p></div></main>;
}
