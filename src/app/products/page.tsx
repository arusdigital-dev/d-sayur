import type { Metadata } from "next";
import { connection } from "next/server";
import { getProducts } from "@/lib/storefront";
import { ProductGrid } from "@/components/product/product-grid";
import { SortChips, parseSort } from "@/components/product/sort-chips";

export const metadata: Metadata = { title: "Semua produk" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; sort?: string }> }) {
  await connection();
  const { search = "", sort: rawSort } = await searchParams;
  const sort = parseSort(rawSort);
  const term = search.slice(0, 100);
  const result = await getProducts({ search: term, sort });
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> DARI KATALOG ODOO</div><h1>{search ? <>Hasil <em>pencarian.</em></> : <>Pilihan <em>segar.</em></>}</h1><p>Produk, varian, harga, dan ketersediaan mengikuti katalog Odoo.</p><form className="catalog-search" action="/products"><label htmlFor="product-search">Cari produk</label><div><input id="product-search" name="search" defaultValue={search} placeholder="Sayur, buah, lauk…" />{sort && <input type="hidden" name="sort" value={sort} />}<button type="submit">Cari</button></div></form><SortChips basePath="/products" sort={sort} search={term} /></div>{result.items.length ? <ProductGrid products={result.items} /> : <div className="catalog-empty"><span className="empty-art" aria-hidden="true">🔎</span><h2>{search ? "Produk tidak ditemukan." : "Katalog sedang disiapkan."}</h2><p>{search ? "Coba kata lain, misalnya “bayam”, “ikan”, atau “paket”." : "Produk akan tampil setelah dipublikasikan di Odoo."}</p></div>}</main>;
}
