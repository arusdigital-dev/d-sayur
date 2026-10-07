import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/account-data";
import { ConfirmReceived } from "@/components/account/confirm-received";
import { OrderProgress } from "@/components/account/order-progress";
import { ReorderButton } from "@/components/account/reorder-button";
import { CancellationRequest } from "@/components/account/cancellation-request";

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
  const fulfillmentLabel: Record<string, string> = { draft: "Draft", waiting: "Menunggu stok", confirmed: "Dikonfirmasi", assigned: "Siap diproses", done: "Selesai", cancel: "Dibatalkan" };
  const progressLabel: Record<string, string> = { pending_payment: "Menunggu pembayaran", paid: "Dibayar · menunggu diproses", packing: "Sedang disiapkan", delivered: "Dalam pengiriman · menunggu konfirmasi", ready_pickup: "Siap diambil", completed: "Selesai", cancelled: "Dibatalkan" };
  return <main className="account-page">
    <div className="catalog-heading"><div className="eyebrow"><span /> DETAIL PESANAN</div><h1>{order.name}<em>.</em></h1><p>{new Date(order.date).toLocaleDateString("id-ID")} · {progressLabel[order.progress_status] ?? order.status} · Pembayaran {order.payment_status}</p></div>
    <OrderProgress status={order.progress_status} />
    {order.payment_instructions && <section className="payment-instructions" aria-label="Instruksi pembayaran"><h2>Cara membayar · {order.payment_method}</h2><p>{order.payment_instructions}</p></section>}
    {order.fulfillment.length > 0 && <section className="order-fulfillment" aria-label="Status pemenuhan pesanan"><h2>Status pemenuhan pesanan</h2>{order.fulfillment.map((picking) => <article key={picking.reference}><span><strong>{picking.reference}</strong><small>{fulfillmentLabel[picking.status] ?? picking.status}</small></span>{picking.scheduled_date && <time dateTime={picking.scheduled_date}>Jadwal: {new Date(picking.scheduled_date).toLocaleString("id-ID")}</time>}{picking.completed_date && <time dateTime={picking.completed_date}>Selesai: {new Date(picking.completed_date).toLocaleString("id-ID")}</time>}</article>)}</section>}
    {order.can_confirm_received && <ConfirmReceived orderId={order.id} />}<Link className="primary-button tracking-open-button" href={`/account/orders/${order.id}/tracking`}>Lacak pesanan <span>↗</span></Link><CancellationRequest orderId={order.id} canRequest={order.can_request_cancellation} alreadyRequested={order.cancellation_requested} reason={order.cancellation_reason} cancellationStatus={order.cancellation_status} /><section className="order-detail-lines">{order.cart.lines.map((line) => <article key={line.id}><span>{line.product.name}{line.variant_name ? ` · ${line.variant_name}` : ""} × {line.quantity}</span><strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: line.total.currency, maximumFractionDigits: 0 }).format(line.total.amount)}</strong></article>)}{total && <article className="summary-total"><strong>Total</strong><strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: total.currency, maximumFractionDigits: 0 }).format(total.amount)}</strong></article>}</section><Link className="text-link" href="/account/orders">← Kembali ke pesanan</Link>
  <div className="order-actions"><ReorderButton orderId={order.id} label="Pesan lagi" /></div></main>;
}
