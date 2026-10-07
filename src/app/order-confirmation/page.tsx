import type { Metadata } from "next";
import Link from "next/link";
import { getOrder } from "@/lib/account-data";
import { AutoRefresh } from "@/components/account/auto-refresh";

export const metadata: Metadata = { title: "Konfirmasi pesanan" };

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const order = order_id ? await getOrder(order_id) : null;
  const paymentStatus = order?.payment_status ?? "";
  const paid = paymentStatus === "done" || (paymentStatus !== "no_transaction" && (order?.status === "sale" || order?.status === "done"));
  const failed = paymentStatus === "error" || paymentStatus === "cancel";
  const noTransaction = paymentStatus === "no_transaction";
  const pending = paymentStatus === "pending" || paymentStatus === "draft" || paymentStatus === "authorized";
  const eyebrow = paid ? "PESANAN DITERIMA" : failed ? "PEMBAYARAN BELUM BERHASIL" : noTransaction ? "PEMBAYARAN BELUM TERCATAT" : pending ? "MENUNGGU PEMBAYARAN" : "MEMERIKSA PEMBAYARAN";
  const title = paid ? "Terima kasih." : failed ? "Pembayaran belum berhasil." : noTransaction ? "Pesanan tercatat, pembayaran belum." : pending ? "Selesaikan pembayaranmu." : "Kami sedang memeriksa pesanan.";
  const description = !order
    ? "Status pesanan belum dapat dimuat. Silakan buka riwayat pesanan atau coba lagi sebentar."
    : noTransaction
      ? "Belum ada transaksi pembayaran yang tertaut ke pesanan ini. Jika saldo Anda sudah terpotong, hubungi Pusat Bantuan sebelum mencoba membayar lagi."
      : failed
        ? "Pembayaran belum berhasil diproses. Buka detail pesanan untuk melihat status terbaru atau hubungi Pusat Bantuan."
        : paid
          ? "Pembayaranmu sudah diterima dan pesanan sedang disiapkan. Kamu bisa melihat perkembangannya dari detail pesanan."
          : "Pesananmu sudah dibuat. Status akan diperbarui setelah pembayaran terkonfirmasi.";

  return (
    <main className="notice-page">
      {order && !paid && !failed && <AutoRefresh />}
      <section className={`confirmation-card${noTransaction ? " is-unrecorded" : ""}`}>
        <div className={`confirmation-status-icon${paid ? " is-success" : failed || noTransaction ? " is-attention" : ""}`} aria-hidden="true">
          {paid ? "✓" : failed ? "!" : noTransaction ? "?" : "◷"}
        </div>
        <div className="eyebrow"><span /> {eyebrow}</div>
        <h1>{title}</h1>
        {order && <div className="confirmation-order-number"><span>Nomor pesanan</span><strong>{order.name}</strong></div>}
        <p className="confirmation-description">{description}</p>
        {order?.payment_instructions && !paid && <section className="payment-instructions"><h2>Petunjuk pembayaran</h2><p>{order.payment_instructions}</p></section>}
        <div className="confirmation-actions">
          <Link className="primary-button" href={order ? `/account/orders/${order.id}` : "/account/orders"}>Lihat detail pesanan <span>↗</span></Link>
          <Link className="text-link" href={noTransaction || failed ? "/account/help" : "/products"}>{noTransaction || failed ? "Pusat Bantuan" : "Kembali belanja"}</Link>
        </div>
      </section>
    </main>
  );
}
