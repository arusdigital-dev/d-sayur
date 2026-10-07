import type { Metadata } from "next";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/storefront";
import { ProductGrid } from "@/components/product/product-grid";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { ProductPagination } from "@/components/product/product-pagination";
import { parseCatalogFilter, parseSort } from "@/lib/catalog-query";

export const metadata: Metadata = { title: "Pencarian produk" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; sort?: string; categorySlug?: string; filter?: string; page?: string }> }) {
  await connection();
  const params = await searchParams;
  const search = (params.search ?? "").slice(0, 100);
  const sort = parseSort(params.sort) ?? "popular";
  const filter = parseCatalogFilter(params.filter);
  const categorySlug = params.categorySlug;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [categories, result] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ search, sort, categorySlug, filter, page, limit: 24 }).catch(() => ({ items: [], page, limit: 24, total: 0 })),
  ]);
  return <main className="catalog-page ds-catalog"><CatalogToolbar categories={categories} selectedCategory={categorySlug} search={search} sort={sort} filter={filter} title={search ? "Pencarian" : "Kategori"} back={Boolean(search)} />
    {result.items.length ? <><ProductGrid products={result.items} /><ProductPagination page={result.page} limit={result.limit} total={result.total} basePath="/products" query={{ search, sort, categorySlug, filter }} /></> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">⌕</span><h2>{filter === "discount" ? "Belum ada produk dengan diskon aktif" : filter === "offers" ? "Belum ada produk dengan penawaran aktif" : search ? "Produk belum ditemukan" : "Produk belum tersedia"}</h2><p>{filter ? "Pilih filter lain atau tekan chip yang aktif untuk menghapus filter." : search ? `Belum ada hasil untuk “${search}”. Coba kata pencarian lain.` : "Produk yang tersedia akan tampil di sini."}</p></div>}
  </main>;
}
