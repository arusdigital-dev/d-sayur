import type { Metadata } from "next";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { ProductGrid } from "@/components/product/product-grid";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { parseSort } from "@/components/product/sort-chips";

export const metadata: Metadata = { title: "Pencarian produk" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; sort?: string; categorySlug?: string }> }) {
  await connection();
  const params = await searchParams;
  const search = (params.search ?? "").slice(0, 100);
  const sort = parseSort(params.sort) ?? "price_asc";
  const categorySlug = params.categorySlug;
  const [categories, result] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ search, sort, categorySlug }).catch(() => ({ items: [], page: 1, limit: 24, total: 0 })),
  ]);
  return <main className="catalog-page ds-catalog"><CatalogToolbar categories={categories} selectedCategory={categorySlug} search={search} sort={sort} title={search ? "Pencarian" : "Kategori"} back={Boolean(search)} />
    {result.items.length ? <ProductGrid products={result.items} /> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">⌕</span><h2>{search ? "Produk belum ditemukan" : "Produk belum tersedia"}</h2><p>{search ? `Belum ada hasil untuk “${search}”. Coba kata pencarian lain.` : "Produk yang tersedia akan tampil di sini."}</p></div>}
  </main>;
}
