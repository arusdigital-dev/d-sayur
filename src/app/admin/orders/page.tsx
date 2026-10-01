import type { Metadata } from "next";
import { AdminOrders } from "@/components/admin/admin-orders";

export const metadata: Metadata = { title: "Kelola Pesanan" };

export default function AdminOrdersPage() {
  return <main className="account-page admin-page"><div className="catalog-heading"><div className="eyebrow"><span /> PANEL ADMIN TOKO</div><h1>Kelola <em>pesanan.</em></h1><p>Pesanan dan status pembayaran disimpan di database D-Sayur.</p></div><AdminOrders /></main>;
}
