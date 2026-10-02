"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { CartSnapshot, StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { BadgeLabel, PriceMeta } from "@/components/product/product-meta";

function priceLabel(amount: number, currency: string, position: string, symbol: string) {
  const value = new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return position === "after" ? `${value.replace(symbol, "").trim()} ${symbol}` : value;
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  async function add(product: StoreProduct) {
    const variant = product.variants.find((item) => item.available);
    if (!variant || pendingId !== null) return;
    setPendingId(product.id);
    setMessage("");
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: variant.id, quantity: 1 }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.quantity }));
      setMessage(`${product.name} ditambahkan. Keranjang berisi ${cart.quantity} item.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Koneksi sedang bermasalah. Silakan coba lagi.");
    } finally { setPendingId(null); }
  }

  return <>
    <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}>
      <Link href={`/products/${product.slug}`} className="product-image"><Image unoptimized fill sizes="(max-width: 560px) 45vw, (max-width: 850px) 42vw, 24vw" src={product.images[0]?.url || "/placeholder.svg"} alt={product.images[0]?.alt ?? product.name} /><BadgeLabel product={product} /></Link>
      <div className="product-card-copy"><div>{product.category && <p className="product-category">{product.category.name}</p>}<Link href={`/products/${product.slug}`}><h2>{product.name}</h2></Link><p className="product-price">{priceLabel(product.price.amount, product.price.currency, product.price.position, product.price.symbol)}</p><PriceMeta product={product} /></div><button type="button" onClick={() => void add(product)} disabled={!product.available || pendingId !== null}>{pendingId === product.id ? "Menambahkan…" : "Tambah"} <span>＋</span></button></div>
    </article>)}</div>
    <p className="cart-feedback" role="status" aria-live="polite">{message}</p>
  </>;
}
