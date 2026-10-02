"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function ConfirmReceived({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setPending(true);
    setError("");
    try {
      await storeApi(`orders/${orderId}/received`, { method: "POST", body: "{}" });
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Konfirmasi belum berhasil.");
    } finally {
      setPending(false);
    }
  }
  return <div className="order-received"><button className="primary-button" type="button" disabled={pending} onClick={() => void confirm()}>{pending ? "Menyimpan…" : "Pesanan sudah diterima"}</button>{error && <p role="alert">{error}</p>}</div>;
}
