import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/storefront";
import { ProductGrid } from "@/components/product/product-grid";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replaceAll("-", " ") };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> KATEGORI PILIHAN</div><h1>{category.name}<em>.</em></h1><p>Produk dari katalog D-Sayur.</p></div>{category.products.length ? <ProductGrid products={category.products} /> : <div className="catalog-empty"><h2>Belum ada produk di kategori ini.</h2></div>}</main>;
}
