import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/storefront";
import { AddToCartButton } from "@/components/product/add-to-cart-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produk tidak ditemukan", robots: { index: false } };
  const description = product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `/products/${product.slug}`;
  return {
    title: product.name,
    description: description || `Lihat ${product.name} di D-Sayur.`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.name,
      description: description || `Lihat ${product.name} di D-Sayur.`,
      url,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currency,
      price: product.price.amount,
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/products/${product.slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString(),
    },
  };
  return <main className="product-detail"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><div className="detail-image"><Image unoptimized fill sizes="(max-width: 850px) 86vw, 40vw" src={product.images[0]?.url || "/placeholder.svg"} alt={product.images[0]?.alt ?? product.name} /></div><div className="detail-copy"><div className="eyebrow"><span /> PILIHAN D-SAYUR</div><h1>{product.name}</h1><p className="detail-description">{product.description}</p><AddToCartButton product={product} /><p className="stock-note">Ketersediaan, varian, dan harga diperiksa ulang saat menambahkan ke keranjang dan checkout.</p></div></main>;
}
