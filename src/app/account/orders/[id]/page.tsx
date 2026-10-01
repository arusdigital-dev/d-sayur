import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/account-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pesanan ${id}` };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const total = order.cart.totals?.total;
  return <main className="account-page"><div className="catalog-heading"><div className="eyebrow"><span /> DETAIL PESANAN</div><h1>{order.name}<em>.</em></h1><p>{new Date(order.date).toLocaleDateString("id-ID")} · {order.status} · pembayaran {order.payment_status}</p></div><section className="order-detail-lines">{order.cart.lines.map((line) => <article key={line.id}><span>{line.product.name} × {line.quantity}</span><strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: line.total.currency, maximumFractionDigits: 0 }).format(line.total.amount)}</strong></article>)}{total && <article className="summary-total"><strong>Total</strong><strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: total.currency, maximumFractionDigits: 0 }).format(total.amount)}</strong></article>}</section><Link className="text-link" href="/account/orders">← Kembali ke pesanan</Link></main>;
}
