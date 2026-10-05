import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getProducts } from "@/lib/storefront";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { ProductGrid } from "@/components/product/product-grid";
import { parseSort } from "@/components/product/sort-chips";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug).catch(() => null);
  return { title: category?.name ?? "Kategori" };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ search?: string; sort?: string }> }) {
  await connection();
  const { slug } = await params;
  const query = await searchParams;
  const search = (query.search ?? "").slice(0, 100);
  const sort = parseSort(query.sort) ?? "price_asc";
  const [category, categories, result] = await Promise.all([
    getCategory(slug), getCategories().catch(() => []), getProducts({ categorySlug: slug, search, sort }).catch(() => null),
  ]);
  if (!category) notFound();
  const products = result?.items ?? category.products;
  return <main className="catalog-page ds-catalog"><CatalogToolbar categories={categories} selectedCategory={slug} search={search} sort={sort} basePath={`/categories/${slug}`} title={category.name} />
    {category.children.length > 0 && <nav className="ds-catalog-subcategories" aria-label="Subkategori">{category.children.map((child) => <a key={child.id} href={`/categories/${child.slug}`}>{child.name}</a>)}</nav>}
    {products.length ? <ProductGrid products={products} /> : <div className="catalog-empty"><h2>Belum ada produk di {category.name}</h2></div>}
  </main>;
}
