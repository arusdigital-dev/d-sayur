"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CartSnapshot, StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { StockAlertForm } from "@/components/product/stock-alert-form";

export function AddToCartButton({ product }: { product: StoreProduct }) {
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.available)?.id ?? product.variants[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<{ id: number; type: "success" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  const selected = product.variants.find((variant) => variant.id === variantId);

  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);

  function variantLabel(variant: StoreProduct["variants"][number]) {
    const label = variant.attributes.map((attribute) => attribute.value).filter(Boolean).join(" · ");
    return label || variant.name.replace(`${product.name} `, "").trim() || product.unit_label || "Standar";
  }

  async function add() {
    if (!selected?.available) return;
    setPending(true);
    setNotice(null);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: variantId, quantity }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.lines.length }));
      const id = Date.now();
      setNotice({ id, type: "success", message: `${product.name} berhasil ditambahkan ke keranjang.` });
      noticeTimer.current = window.setTimeout(() => setNotice((current) => current?.id === id ? null : current), 3600);
    } catch (reason) {
      setNotice({ id: Date.now(), type: "error", message: reason instanceof Error ? reason.message : "Koneksi sedang bermasalah. Silakan coba lagi." });
    } finally { setPending(false); }
  }

  const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  return <div className="detail-actions">
    {selected && <p className="detail-price">{formatMoney(selected.price.amount, selected.price.currency)} <small>{product.variants.length > 1 ? variantLabel(selected) : product.unit_label || variantLabel(selected)}</small></p>}
    {product.variants.length > 1 && <div className="detail-variants"><span>Pilih ukuran / satuan</span><div>{product.variants.map((variant) => <button type="button" key={variant.id} className={variant.id === variantId ? "selected" : ""} aria-pressed={variant.id === variantId} disabled={!variant.available} onClick={() => setVariantId(variant.id)}>{variantLabel(variant)}</button>)}</div></div>}
    <div className="detail-quantity-field"><span>Jumlah</span><div className="detail-quantity-stepper"><button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Tambah jumlah" disabled={quantity >= 100} onClick={() => setQuantity((value) => Math.min(100, value + 1))}>+</button></div></div>
    <div className="detail-purchase-bar"><div><small>Total harga</small><strong>{formatMoney((selected?.price.amount ?? product.price.amount) * quantity, selected?.price.currency ?? product.price.currency)}</strong></div><button className="primary-button" type="button" disabled={!selected?.available || pending || !variantId} onClick={() => void add()}>{pending ? "Menambahkan…" : "Masukkan keranjang"}<span aria-hidden="true">↗</span></button></div>
    {notice && <div key={notice.id} className={`cart-add-toast is-${notice.type}`} role={notice.type === "error" ? "alert" : "status"} aria-live={notice.type === "error" ? "assertive" : "polite"}>
      <span className="cart-add-toast-icon" aria-hidden="true">{notice.type === "success" ? "✓" : "!"}</span>
      <span className="cart-add-toast-copy">{notice.message}{notice.type === "success" && <small>Keranjang sudah diperbarui.</small>}</span>
      {notice.type === "success" && <Link href="/cart">Lihat keranjang</Link>}
    </div>}
    {selected && !selected.available && <StockAlertForm productId={selected.id} />}
  </div>;
}
