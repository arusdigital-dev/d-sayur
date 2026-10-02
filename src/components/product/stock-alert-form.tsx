"use client";

import { useState } from "react";
import { storeApi } from "@/lib/store-api";

export function StockAlertForm({ productId }: { productId: number }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await storeApi<{ subscribed: boolean; already_available?: boolean }>("stock-alerts", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, email }),
      });
      setMessage(result.already_available ? "Produk sudah tersedia—silakan tambahkan ke keranjang." : "Siap. Kami akan mengirim email saat stok tersedia kembali.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Permintaan belum berhasil.");
    } finally {
      setPending(false);
    }
  }

  return <form className="stock-alert-form" onSubmit={subscribe}>
    <p>Stok sedang kosong. Tinggalkan email untuk menerima kabar saat produk tersedia kembali.</p>
    <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Ingatkan saya"}</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}
