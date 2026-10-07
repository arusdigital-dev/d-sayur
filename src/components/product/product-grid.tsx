"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { StoreProduct } from "@/types/store";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { storeApi } from "@/lib/store-api";
import { BadgeLabel } from "@/components/product/product-meta";

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
  const [loggedIn, setLoggedIn] = useState(false);
  const [favoritesReady, setFavoritesReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFavorites() {
      try {
        let auth: { logged_in: boolean };
        try {
          auth = await storeApi<{ logged_in: boolean }>("auth/me");
        } catch {
          if (active) loadGuestFavorites();
          return;
        }
        if (!active) return;
        setLoggedIn(auth.logged_in);
        if (auth.logged_in) {
          try { setFavorites(await storeApi<number[]>("favorites")); }
          catch { setFavorites([]); }
        } else {
          loadGuestFavorites();
        }
      } finally {
        if (active) setFavoritesReady(true);
      }
    }
    function loadGuestFavorites() {
      try {
        const stored = window.localStorage.getItem("dsayur:favorites");
        if (!stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((id): id is number => Number.isInteger(id)));
      } catch {
        // Keep favorite controls usable when browser storage is unavailable.
      }
    }
    void loadFavorites();
    return () => { active = false; };
  }, []);

  const toggleFavorite = async (productId: number) => {
    if (!favoritesReady) return;
    const previous = favorites;
    const isFavorite = favorites.includes(productId);
    const nextFavorites = isFavorite ? favorites.filter((id) => id !== productId) : [...favorites, productId];
    setFavorites(nextFavorites);
    if (loggedIn) {
      try {
        setFavorites(await storeApi<number[]>(`favorites/${productId}`, { method: isFavorite ? "DELETE" : "POST" }));
      } catch {
        setFavorites(previous);
      }
      return;
    }
    try {
      window.localStorage.setItem("dsayur:favorites", JSON.stringify(nextFavorites));
    } catch {
      // The visible favorite state still updates if browser storage is unavailable.
    }
  };

  return <div className="product-grid">{products.map((product) => {
      const stock = stockDisplay(product);
      return <article className="product-card" key={product.id}>
      <div className="product-media"><Link href={`/products/${product.slug}`} className="product-image"><Image unoptimized fill sizes="(max-width: 560px) 45vw, (max-width: 850px) 42vw, 24vw" src={storefrontProductPhoto(product)} alt={product.images[0]?.alt ?? product.name} /><BadgeLabel product={product} /></Link><button type="button" className={`product-favorite${favorites.includes(product.id) ? " is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? `Hapus ${product.name} dari favorit` : `Simpan ${product.name} ke favorit`} aria-pressed={favorites.includes(product.id)} disabled={!favoritesReady} onClick={() => void toggleFavorite(product.id)}>{favorites.includes(product.id) ? "♥" : "♡"}</button></div>
      <Link className="product-card-copy" href={`/products/${product.slug}`}><div className="product-card-info"><h2>{product.name}{product.unit_label && <span className="product-card-unit">{product.unit_label}</span>}</h2><p className={`product-stock${stock.inStock ? " is-available" : " is-empty"}`}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m2 5 6-3 6 3v6l-6 3-6-3V5Z"/><path d="m2 5 6 3 6-3M8 8v6M5 3.5l6 3"/></svg>{stock.label}</p><p className="product-price">{product.variants.length > 1 ? "Mulai " : ""}{priceLabel(product.price.amount, product.price.currency, product.price.position, product.price.symbol)}</p>{product.variants.length > 1 && <small className="product-card-variant-count">{product.variants.length} pilihan ukuran</small>}</div><span className="product-card-open" aria-hidden="true">Lihat detail&nbsp; ↗</span></Link>
    </article>;
    })}</div>;
}
