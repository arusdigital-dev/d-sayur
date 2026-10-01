import type { Metadata } from "next";
import Link from "next/link";
import { getOrder } from "@/lib/account-data";

export const metadata: Metadata = { title: "Konfirmasi pesanan" };

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const order = order_id ? await getOrder(order_id) : null;
  const paid = order?.payment_status === "done" || order?.status === "sale" || order?.status === "done";
  const failed = order?.payment_status === "error" || order?.payment_status === "cancel";
  return <main className="notice-page"><section className="confirmation-card"><span className="notice-mark">{paid ? "✳" : failed ? "↻" : "◷"}</span><div className="eyebrow"><span /> {paid ? "PESANAN DITERIMA" : failed ? "PEMBAYARAN BELUM BERHASIL" : "PEMBAYARAN DIPROSES"}</div><h1>{paid ? "Terima kasih." : failed ? "Coba lagi." : "Sebentar, ya."}</h1><p>{order ? `${order.name} · Status pembayaran: ${order.payment_status}` : "Status terbaru pesanan belum dapat dimuat. Periksa riwayat pesanan Anda setelah beberapa saat."}</p><div className="confirmation-actions"><Link className="primary-button" href="/account/orders">Lihat pesanan <span>↗</span></Link><Link className="text-link" href="/products">Kembali belanja</Link></div></section></main>;
}
