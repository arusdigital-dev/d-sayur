import type { Metadata } from "next";
import { getProducts } from "@/lib/storefront";
import { ProductGrid } from "@/components/product/product-grid";

export const metadata: Metadata = { title: "Semua produk" };

export default async function ProductsPage() {
  const result = await getProducts();
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> DARI KEBUN UNTUKMU</div><h1>Pilihan <em>segar.</em></h1><p>Produk dan harga dari katalog D-Sayur.</p></div>{result.items.length ? <ProductGrid products={result.items} /> : <div className="catalog-empty"><span>✳</span><h2>Katalog sedang disiapkan.</h2><p>Tambahkan dan publikasikan produk dari panel Kelola Toko.</p></div>}</main>;
}
