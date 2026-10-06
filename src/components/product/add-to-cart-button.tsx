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
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.lines.length }));
      setMessage(`Berhasil ditambahkan. Keranjang sekarang berisi ${cart.lines.length} jenis item.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Koneksi sedang bermasalah. Silakan coba lagi.");
    } finally { setPending(false); }
  }

  const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  return <div className="detail-actions">
    {selected && <p className="detail-price">{formatMoney(selected.price.amount, selected.price.currency)} <small>{product.unit_label || selected.name}</small></p>}
    {product.variants.length > 1 && <div className="detail-variants"><span>Pilih variasi</span><div>{product.variants.map((variant) => <button type="button" key={variant.id} className={variant.id === variantId ? "selected" : ""} aria-pressed={variant.id === variantId} disabled={!variant.available} onClick={() => setVariantId(variant.id)}>{variant.name}</button>)}</div></div>}
    <div className="detail-quantity-field"><span>Jumlah</span><div className="detail-quantity-stepper"><button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Tambah jumlah" disabled={quantity >= 100} onClick={() => setQuantity((value) => Math.min(100, value + 1))}>+</button></div></div>
    <div className="detail-purchase-bar"><div><small>Total harga</small><strong>{formatMoney((selected?.price.amount ?? product.price.amount) * quantity, selected?.price.currency ?? product.price.currency)}</strong></div><button className="primary-button" type="button" disabled={!selected?.available || pending || !variantId} onClick={() => void add()}>{pending ? "Menambahkan…" : "Masukkan keranjang"}<span aria-hidden="true">↗</span></button></div>
    <p className="detail-action-status" role="status" aria-live="polite">{message}</p>
    {selected && !selected.available && <StockAlertForm productId={selected.id} />}
  </div>;
}
