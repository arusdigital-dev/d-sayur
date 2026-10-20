"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";
import type { CartSnapshot } from "@/types/store";

export function ReorderButton({ orderId, label = "Pesan lagi", className = "secondary-button" }: { orderId: number; label?: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function reorder() {
    setPending(true); setMessage("");
    try {
      const result = await storeApi<{ cart: CartSnapshot; added: number; skipped: string[] }>(`orders/${orderId}/reorder`, { method: "POST", body: "{}" });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: result.cart.quantity }));
      router.push("/cart");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Pesanan belum dapat diulang."); }
    finally { setPending(false); }
  }
  return <span className="reorder"><button className={className} type="button" disabled={pending} onClick={() => void reorder()}>{pending ? "Menyiapkan…" : label}</button>{message && <small role="alert">{message}</small>}</span>;
}
