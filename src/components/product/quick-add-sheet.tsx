"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CartSnapshot, StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { storefrontProductPhoto } from "@/lib/product-photo";

const money = (amount: number, currency: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

export function QuickAddSheet({ product, onClose }: { product: StoreProduct; onClose: () => void }) {
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.available)?.id ?? product.variants[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const selected = product.variants.find((variant) => variant.id === variantId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("quick-sheet-open");
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.classList.remove("quick-sheet-open"); };
  }, [onClose]);

  async function add() {
    if (!selected?.available || !variantId) return;
    setPending(true);
    setMessage("");
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: variantId, quantity }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.lines.length }));
      setMessage(`${product.name} ditambahkan ke keranjang.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Produk belum dapat ditambahkan. Coba lagi.");
    } finally { setPending(false); }
  }

  return <div className="quick-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-sheet-title">
      <div className="quick-sheet-handle" aria-hidden="true" />
      <header><h2 id="quick-sheet-title">Keranjang belanja</h2><button type="button" aria-label="Tutup" onClick={onClose}>×</button></header>
      <div className="quick-sheet-product">
        <Image unoptimized src={storefrontProductPhoto(product)} alt={product.name} width={72} height={72} />
        <div><strong>{product.name}</strong><small>{selected?.name ?? product.unit_label ?? "Produk segar"}</small><b>{money(selected?.price.amount ?? product.price.amount, selected?.price.currency ?? product.price.currency)}</b></div>
        <div className="quick-sheet-quantity" aria-label="Jumlah produk">
          <button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
          <output aria-live="polite">{quantity}</output>
          <button type="button" aria-label="Tambah jumlah" disabled={quantity >= 100} onClick={() => setQuantity((value) => Math.min(100, value + 1))}>+</button>
        </div>
      </div>
      {product.variants.length > 1 && <div className="quick-sheet-variants"><p>Pilih varian</p>{product.variants.map((variant) => <button className={variant.id === variantId ? "selected" : ""} type="button" key={variant.id} disabled={!variant.available} aria-pressed={variant.id === variantId} onClick={() => setVariantId(variant.id)}>{variant.name}</button>)}</div>}
      {message && <p className="quick-sheet-status" role="status">{message}</p>}
      <footer><Link href={`/products/${product.slug}`}>Lihat detail produk</Link><button type="button" disabled={!selected?.available || pending || !variantId} onClick={() => void add()}>{pending ? "Menambahkan…" : "Masukkan keranjang"}<span aria-hidden="true">↗</span></button></footer>
    </section>
  </div>;
}
