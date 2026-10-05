import type { Metadata } from "next";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { ProductGrid } from "@/components/product/product-grid";
import { parseSort } from "@/components/product/sort-chips";

export const metadata: Metadata = { title: "Kategori produk" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ categorySlug?: string; search?: string; sort?: string }> }) {
  await connection();
  const params = await searchParams;
  const selectedCategory = params.categorySlug;
  const search = (params.search ?? "").slice(0, 100);
  const sort = parseSort(params.sort) ?? "price_asc";
  const [categories, result] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ categorySlug: selectedCategory, search, sort }).catch(() => ({ items: [], page: 1, limit: 24, total: 0 })),
  ]);
  const selectedName = categories.find((category) => category.slug === selectedCategory)?.name;
  return <main className="catalog-page ds-catalog"><CatalogToolbar categories={categories} selectedCategory={selectedCategory} search={search} sort={sort} basePath="/categories" title={selectedName ?? "Kategori"} />
    {result.items.length ? <ProductGrid products={result.items} /> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">⌕</span><h2>{selectedName ? `Belum ada produk di ${selectedName}` : "Produk belum tersedia"}</h2><p>Pilih kategori lain atau kembali lagi nanti.</p></div>}
  </main>;
}
