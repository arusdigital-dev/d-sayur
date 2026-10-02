"use client";

import { useState } from "react";
import type { CartSnapshot, StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { StockAlertForm } from "@/components/product/stock-alert-form";

export function AddToCartButton({ product }: { product: StoreProduct }) {
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.available)?.id ?? product.variants[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const selected = product.variants.find((variant) => variant.id === variantId);

  async function add() {
    if (!selected?.available) return;
    setPending(true);
    setMessage("");
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: variantId, quantity }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.quantity }));
      setMessage(`Berhasil ditambahkan. Keranjang sekarang berisi ${cart.quantity} item.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Koneksi sedang bermasalah. Silakan coba lagi.");
    } finally { setPending(false); }
  }

  return <div className="detail-actions">
    {product.variants.length > 1 && <label className="variant-select">Pilih varian<select value={variantId} onChange={(event) => setVariantId(Number(event.target.value))}>{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{variant.available ? "" : " · stok habis"}</option>)}</select></label>}
    {selected && <p className="detail-price">{new Intl.NumberFormat("id-ID", { style: "currency", currency: selected.price.currency, maximumFractionDigits: 0 }).format(selected.price.amount)}</p>}
    <div className="detail-cart-actions"><label className="variant-select">Jumlah<input aria-label="Jumlah produk" type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label><button className="primary-button" type="button" disabled={!selected?.available || pending || !variantId} onClick={() => void add()}>{pending ? "Menambahkan…" : "Tambah ke keranjang"}<span>↗</span></button></div>
    <p role="status" aria-live="polite">{message}</p>
    {selected && !selected.available && <StockAlertForm productId={selected.id} />}
  </div>;
}
