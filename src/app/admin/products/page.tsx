import type { Metadata } from "next";
import { ProductManager } from "@/components/admin/product-manager";

export const metadata: Metadata = { title: "Kelola Toko" };

export default function AdminProductsPage() {
  return <main className="account-page admin-page"><div className="catalog-heading"><div className="eyebrow"><span /> PANEL ADMIN TOKO</div><h1>Kelola <em>toko.</em></h1><p>Kelola katalog, stok, kategori, dan pesanan melalui Next.js.</p></div><ProductManager /></main>;
}
