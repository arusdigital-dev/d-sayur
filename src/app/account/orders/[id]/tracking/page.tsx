import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/account/auto-refresh";
import { getOrder } from "@/lib/account-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Lacak pesanan ${id}` };
}

const stages = [
  { key: "received", label: "Pesanan Diterima", icon: "✓" },
  { key: "preparing", label: "Pesanan Disiapkan", icon: "▰" },
  { key: "delivery", label: "Dalam Pengiriman", icon: "➤" },
  { key: "complete", label: "Pesanan Selesai", icon: "⌂" },
];

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const cancelled = order.progress_status === "cancelled";
  const pickup = order.progress_status === "ready_pickup";
  const currentStage = cancelled ? -1 : order.progress_status === "pending_payment" ? 0
    : order.progress_status === "paid" || order.progress_status === "packing" ? 1
    : order.progress_status === "delivered" || pickup ? 2 : 3;
  const mapAvailable = order.shipping_address.latitude != null && order.shipping_address.longitude != null;
  const latitude = order.shipping_address.latitude;
  const longitude = order.shipping_address.longitude;
  const mapDelta = 0.008;
  const mapSrc = mapAvailable
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude! - mapDelta}%2C${latitude! - mapDelta}%2C${longitude! + mapDelta}%2C${latitude! + mapDelta}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : undefined;
  const active = ["pending_payment", "paid", "packing"].includes(order.progress_status);

  return <main className="order-tracking-page">
    {active && <AutoRefresh intervalMs={15000} maxTries={80} />}
    <section className="tracking-map" aria-label="Peta lokasi pengiriman">
      {mapSrc ? <iframe title="Peta tujuan pengiriman" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" /> : <div className="tracking-map-empty"><span>⌖</span><strong>Pin lokasi belum tersedia</strong><small>Alamat tujuan dapat dilihat di detail pesanan.</small></div>}
      <Link className="tracking-back" href={`/account/orders/${order.id}`} aria-label="Kembali ke detail pesanan">‹</Link>
      {mapAvailable && <a className="tracking-map-link" href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`} target="_blank" rel="noreferrer" aria-label="Buka peta tujuan">↗</a>}
      <div className="tracking-recipient"><span className="tracking-recipient-icon">⌖</span><div><small>Tujuan pengantaran{order.fulfillment[0] ? ` · ${order.fulfillment[0].reference}` : ""}</small><strong>{order.shipping_address.name || "Penerima pesanan"}</strong><span>{[order.shipping_address.street, order.shipping_address.street2, order.shipping_address.city].filter(Boolean).join(", ") || "Alamat belum tersedia"}</span></div>{order.shipping_address.phone && <a href={`tel:${order.shipping_address.phone}`} aria-label="Telepon penerima">☎</a>}</div>
    </section>

    <section className="tracking-sheet">
      <div className="tracking-order-heading"><span className="tracking-live-dot" />{cancelled ? "Pesanan Dibatalkan" : pickup ? "Siap Diambil" : order.progress_status === "completed" ? "Pesanan Selesai" : order.progress_status === "delivered" ? "Pesanan Telah Tiba" : order.progress_status === "pending_payment" ? "Menunggu Pembayaran" : "Pesanan Sedang Diproses"}<small>{order.name} · {new Date(order.date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</small></div>
      {cancelled ? <p className="tracking-cancelled">Pesanan ini dibatalkan. Buka detail pesanan untuk melihat informasi selengkapnya.</p> : <ol className="tracking-timeline" aria-label="Perjalanan pesanan">{stages.map((stage, index) => {
        const done = index < currentStage;
        const current = index === currentStage;
        const stageLabel = stage.key === "delivery" ? pickup ? "Siap Diambil" : order.progress_status === "delivered" ? "Pesanan Telah Tiba" : stage.label : stage.label;
        const description = stage.key === "received"
          ? order.progress_status === "pending_payment" ? `Menunggu pembayaran · ${order.payment_status}` : `Pembayaran ${order.payment_status}`
          : stage.key === "preparing"
            ? current ? order.progress_status === "packing" ? "Pesanan sedang disiapkan" : "Menunggu pesanan disiapkan" : "Pesanan siap dikirim"
            : stage.key === "delivery"
              ? pickup ? "Silakan ambil pesanan di toko" : order.progress_status === "delivered" ? "Pengiriman tercatat selesai" : "Menunggu pesanan selesai disiapkan"
              : "Pembaruan status pesanan";
        return <li key={stage.key} className={`${done ? "is-done" : ""} ${current ? "is-current" : ""}`}><span className="tracking-stage-icon" aria-hidden="true">{done ? "✓" : stage.icon}</span><div><strong>{stageLabel}</strong><small>{description}</small></div></li>;
      })}</ol>}
      <Link className="tracking-detail-button" href={`/account/orders/${order.id}`}>Lihat Detail Pesanan <span>↗</span></Link>
    </section>
  </main>;
}
