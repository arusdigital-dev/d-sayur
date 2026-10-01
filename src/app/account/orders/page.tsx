import type { Metadata } from "next";
import Link from "next/link";
import { getOrders } from "@/lib/account-data";

export const metadata: Metadata = { title: "Riwayat pesanan" };

export default async function OrderHistoryPage() {
  const orders = await getOrders();
  return <main className="account-page"><div className="catalog-heading"><div className="eyebrow"><span /> AKUN PELANGGAN</div><h1>Riwayat <em>pesanan.</em></h1></div>{orders?.length ? <div className="order-list">{orders.map((order) => <Link href={`/account/orders/${order.id}`} key={order.id}><span><b>{order.name}</b><small>{new Date(order.date).toLocaleDateString("id-ID")}</small></span><span>{order.status}</span><strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: order.total.currency, maximumFractionDigits: 0 }).format(order.total.amount)}</strong><i>↗</i></Link>)}</div> : <div className="catalog-empty"><h2>Belum ada pesanan.</h2><p>Pesanan dari toko ini akan muncul di sini setelah checkout.</p></div>}</main>;
}
