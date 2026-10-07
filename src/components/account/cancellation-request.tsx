"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function CancellationRequest({ orderId, canRequest, alreadyRequested, reason, cancellationStatus }: { orderId: number; canRequest: boolean; alreadyRequested: boolean; reason: string; cancellationStatus: "review" | "refund_pending" | "refund_failed" | "refund_review" | "refunded" | "manual_refunded" | "cancelled" | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await storeApi(`orders/${orderId}/cancel`, { method: "POST", body: JSON.stringify({ reason: value.trim() }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permintaan pembatalan belum berhasil dikirim.");
    } finally {
      setPending(false);
    }
  }

  if (alreadyRequested) {
    const heading = cancellationStatus === "manual_refunded" ? "Pesanan dibatalkan · refund dicatat toko" : cancellationStatus === "refunded" ? "Pesanan dibatalkan · refund berhasil" : cancellationStatus === "refund_review" ? "Pesanan dibatalkan · status refund diperiksa" : cancellationStatus === "refund_failed" ? "Pesanan dibatalkan · refund perlu ditinjau" : cancellationStatus === "refund_pending" ? "Pengiriman dibatalkan · refund menunggu diproses" : cancellationStatus === "cancelled" ? "Pesanan telah dibatalkan" : "Permintaan pembatalan sedang ditinjau";
    const detail = cancellationStatus === "manual_refunded"
      ? "Tim toko telah mencatat pengembalian dana secara manual di Odoo. Hubungi pusat bantuan jika dana belum diterima."
      : cancellationStatus === "refunded"
        ? "Pengembalian dana telah dikonfirmasi."
      : cancellationStatus === "refund_review"
        ? "Status permintaan refund belum dapat dipastikan. Tim toko sedang mencocokkan transaksi."
        : cancellationStatus === "refund_failed"
          ? "Refund belum berhasil. Tim toko sedang memeriksa transaksi pembayaran Anda."
          : cancellationStatus === "refund_pending"
            ? "Pembayaran berhasil. Tim toko sedang memproses pengembalian dana."
            : cancellationStatus === "cancelled"
              ? "Pesanan sudah dibatalkan oleh tim toko."
              : "Tim toko akan memeriksa pesanan dan status pembayarannya.";
    return <aside className="cancellation-request-status" role="status"><strong>{heading}</strong><p>{reason ? `Alasan: ${reason}. ` : ""}{detail}</p></aside>;
  }
  if (!canRequest) return null;

  return <section className="cancellation-request">
    {!open ? <button className="cancellation-request-open" type="button" onClick={() => setOpen(true)}>Ajukan pembatalan</button> : <form onSubmit={submit}>
      <label>Alasan pembatalan (opsional)<textarea maxLength={500} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ceritakan alasan pembatalan" /></label>
      <p>Permintaan akan ditinjau tim toko. Jika pesanan sudah dibayar, pengembalian dana perlu diproses setelah pemeriksaan.</p>
      <div><button className="cancellation-request-submit" type="submit" disabled={pending}>{pending ? "Mengirim…" : "Kirim permintaan"}</button><button className="cancellation-request-dismiss" type="button" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Kembali</button></div>
      {error && <small role="alert">{error}</small>}
    </form>}
  </section>;
}
