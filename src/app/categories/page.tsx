import type { Metadata } from "next";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductPagination } from "@/components/product/product-pagination";
import { parseCatalogFilter, parseSort } from "@/lib/catalog-query";

export const metadata: Metadata = { title: "Kategori produk" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ categorySlug?: string; search?: string; sort?: string; filter?: string; page?: string }> }) {
  await connection();
  const params = await searchParams;
  const selectedCategory = params.categorySlug;
  const search = (params.search ?? "").slice(0, 100);
  const sort = parseSort(params.sort) ?? "popular";
  const filter = parseCatalogFilter(params.filter);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [categories, result] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ categorySlug: selectedCategory, search, sort, filter, page, limit: 24 }).catch(() => ({ items: [], page, limit: 24, total: 0 })),
  ]);
  const selectedName = categories.find((category) => category.slug === selectedCategory)?.name;
  return <main className="catalog-page ds-catalog"><CatalogToolbar categories={categories} selectedCategory={selectedCategory} search={search} sort={sort} filter={filter} basePath="/categories" title={selectedName ?? "Kategori"} />
    {result.items.length ? <><ProductGrid products={result.items} /><ProductPagination page={result.page} limit={result.limit} total={result.total} basePath="/categories" query={{ categorySlug: selectedCategory, search, sort, filter }} /></> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">⌕</span><h2>{filter === "discount" ? "Belum ada produk dengan diskon aktif" : filter === "offers" ? "Belum ada produk dengan penawaran aktif" : selectedName ? `Belum ada produk di ${selectedName}` : "Produk belum tersedia"}</h2><p>{filter ? "Pilih filter lain atau tekan chip yang aktif untuk menghapus filter." : "Pilih kategori lain atau kembali lagi nanti."}</p></div>}
  </main>;
}
