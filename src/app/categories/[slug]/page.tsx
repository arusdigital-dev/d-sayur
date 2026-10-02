import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/storefront";
import { categoryIcon } from "@/lib/category-icon";
import { ProductGrid } from "@/components/product/product-grid";
import { SortChips, parseSort } from "@/components/product/sort-chips";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug).catch(() => null);
  return { title: category?.name ?? "Kategori" };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> }) {
  await connection();
  const { slug } = await params;
  const sort = parseSort((await searchParams).sort);
  const category = await getCategory(slug);
  if (!category) notFound();
  const products = sort === "price_asc" ? [...category.products].sort((a, b) => a.price.amount - b.price.amount) : sort === "price_desc" ? [...category.products].sort((a, b) => b.price.amount - a.price.amount) : category.products;
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> KATEGORI PILIHAN</div><h1><span className="cat-icon" aria-hidden="true">{categoryIcon(category.name)}</span>{category.name}<em>.</em></h1><p>Produk dari katalog D-Sayur.</p>{category.children.length > 0 && <nav className="chip-row" aria-label="Subkategori">{category.children.map((child) => <Link key={child.id} className="chip" href={`/categories/${child.slug}`}>{child.name}</Link>)}</nav>}<SortChips basePath={`/categories/${slug}`} sort={sort} /></div>{products.length ? <ProductGrid products={products} /> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">🥕</span><h2>Belum ada produk di kategori ini.</h2></div>}</main>;
}
