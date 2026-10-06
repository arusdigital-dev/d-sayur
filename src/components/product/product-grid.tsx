"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { StoreProduct } from "@/types/store";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { BadgeLabel } from "@/components/product/product-meta";
import { QuickAddSheet } from "@/components/product/quick-add-sheet";

function priceLabel(amount: number, currency: string, position: string, symbol: string) {
  const value = new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return position === "after" ? `${value.replace(symbol, "").trim()} ${symbol}` : value;
}

function stockDisplay(product: StoreProduct) {
  if (typeof product.stock_on_hand !== "number") {
    return { inStock: product.available, label: product.available ? "Tersedia" : "Stok habis" };
  }
  if (product.stock_on_hand > 0) {
    return { inStock: true, label: `Tersedia ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(product.stock_on_hand)}` };
  }
  return { inStock: false, label: product.available ? "Pre-order" : "Stok habis" };
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [quickAdd, setQuickAdd] = useState<StoreProduct | null>(null);
  const closeQuickAdd = useCallback(() => setQuickAdd(null), []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dsayur:favorites");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.filter((id): id is number => Number.isInteger(id)));
        }
      }
    } catch {
      // Keep favorites usable for this session when browser storage is unavailable.
    }
  }, []);

  const toggleFavorite = (productId: number) => {
    const nextFavorites = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];
    setFavorites(nextFavorites);
    try {
      window.localStorage.setItem("dsayur:favorites", JSON.stringify(nextFavorites));
    } catch {
      // The visible favorite state still updates if browser storage is unavailable.
    }
  };

  return <>
    <div className="product-grid">{products.map((product) => {
      const stock = stockDisplay(product);
      return <article className="product-card" key={product.id}>
      <div className="product-media"><Link href={`/products/${product.slug}`} className="product-image"><Image unoptimized fill sizes="(max-width: 560px) 45vw, (max-width: 850px) 42vw, 24vw" src={storefrontProductPhoto(product)} alt={product.images[0]?.alt ?? product.name} /><BadgeLabel product={product} /></Link><button type="button" className={`product-favorite${favorites.includes(product.id) ? " is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? `Hapus ${product.name} dari favorit` : `Simpan ${product.name} ke favorit`} aria-pressed={favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)}>{favorites.includes(product.id) ? "♥" : "♡"}</button></div>
      <div className="product-card-copy"><div className="product-card-info"><Link href={`/products/${product.slug}`}><h2>{product.name}{product.unit_label && <span className="product-card-unit">{product.unit_label}</span>}</h2></Link><p className={`product-stock${stock.inStock ? " is-available" : " is-empty"}`}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m2 5 6-3 6 3v6l-6 3-6-3V5Z"/><path d="m2 5 6 3 6-3M8 8v6M5 3.5l6 3"/></svg>{stock.label}</p><p className="product-price">{priceLabel(product.price.amount, product.price.currency, product.price.position, product.price.symbol)}</p></div><button type="button" className="product-add-button" aria-label={`Tambah ${product.name} ke keranjang`} onClick={() => setQuickAdd(product)}><span aria-hidden="true">+</span></button></div>
    </article>;
    })}</div>
    {quickAdd && <QuickAddSheet product={quickAdd} onClose={closeQuickAdd} />}
  </>;
}
