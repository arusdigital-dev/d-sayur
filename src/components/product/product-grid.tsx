"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { homeAssets } from "@/config/home-assets";
import { BadgeLabel } from "@/components/product/product-meta";
import { AddToCartSheet } from "@/components/cart/add-to-cart-sheet";

function priceLabel(amount: number, currency: string, position: string, symbol: string) {
  const value = new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return position === "after" ? `${value.replace(symbol, "").trim()} ${symbol}` : value;
}

function stockDisplay(product: StoreProduct) {
  const quantity = typeof product.stock_on_hand === "number"
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(product.stock_on_hand)
    : null;
  const inStock = product.available && (product.stock_on_hand === undefined || product.stock_on_hand > 0);
  const label = typeof product.stock_on_hand !== "number"
    ? product.available ? "Tersedia" : "Stok habis"
    : product.stock_on_hand > 0 ? `Tersedia ${quantity}` : product.available ? "Pre-order" : "Stok habis";
  return { inStock, quantity, label };
}

type ProductGridProps = { products: StoreProduct[]; returnTo?: string; quickAdd?: boolean; className?: string; showAvailability?: boolean; showStockQuantity?: boolean };

export function ProductGrid({ products, returnTo = "/products", quickAdd = false, className = "", showAvailability = true, showStockQuantity = true }: ProductGridProps) {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [activeProduct, setActiveProduct] = useState<StoreProduct | null>(null);
  const [addedNotice, setAddedNotice] = useState<{ id: number; message: string } | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => () => { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); }, []);
  const closeSheet = useCallback(() => setActiveProduct(null), []);
  const handleAdded = useCallback((product: StoreProduct, quantity: number) => {
    const id = Date.now();
    setAddedNotice({ id, message: `${product.name} (${quantity}) berhasil ditambahkan.` });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setAddedNotice((current) => current?.id === id ? null : current), 4800);
  }, []);

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

  return <>
    <div className={`product-grid${className ? ` ${className}` : ""}`}>
      {products.map((product) => {
        const stock = stockDisplay(product);
        const detailHref = `/products/${product.slug}?returnTo=${encodeURIComponent(returnTo)}`;
        const photo = storefrontProductPhoto(product);
        return <article className="product-card" key={product.id}>
          <div className="product-media">
            <Link href={detailHref} className="product-image"><Image unoptimized fill sizes="(max-width: 560px) 45vw, (max-width: 850px) 42vw, 24vw" src={photo} alt={product.images[0]?.alt ?? product.name} />{(product.discount_percent || product.badge) && <span className="product-card-badges">{product.discount_percent ? <span className="discount-badge">Diskon {product.discount_percent}%</span> : null}<BadgeLabel product={product} /></span>}</Link>
            <button type="button" className={`product-favorite${favorites.includes(product.id) ? " is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? `Hapus ${product.name} dari favorit` : `Simpan ${product.name} ke favorit`} aria-pressed={favorites.includes(product.id)} disabled={!favoritesReady} onClick={() => void toggleFavorite(product.id)}><span aria-hidden="true">{favorites.includes(product.id) ? "♥" : "♡"}</span></button>
          </div>
          <div className={`product-card-copy${quickAdd ? " product-card-copy-quick-add" : ""}`}>
            <Link className="product-card-info" href={detailHref}>
              <h2>{product.name}{showAvailability && product.unit_label && <span className="product-card-unit">{product.unit_label}</span>}</h2>
              <p className={`product-stock${stock.inStock ? " is-available" : " is-empty"}`} aria-label={showAvailability || showStockQuantity ? stock.inStock ? `${product.unit_label ?? "Per unit"}${stock.quantity ? `, ${stock.quantity} tersedia` : ""}` : "Stok habis" : product.unit_label || "Per unit"}>
                <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m2 5 6-3 6 3v6l-6 3-6-3V5Z"/><path d="m2 5 6 3 6-3M8 8v6M5 3.5l6 3"/></svg>
                {showAvailability ? stock.label : <>
                  <span className="product-stock-unit">{product.unit_label || "Per unit"}</span>
                  {showStockQuantity && stock.inStock && stock.quantity !== null && <span className="product-stock-quantity" aria-hidden="true">{stock.quantity}</span>}
                  {showStockQuantity && !stock.inStock && <span className="product-stock-empty">Stok habis</span>}
                </>}
              </p>
              <p className={`product-price${product.compare_at_price ? " is-discounted" : ""}`}><span>{product.variants.length > 1 ? "Mulai " : ""}{priceLabel(product.price.amount, product.price.currency, product.price.position, product.price.symbol)}</span>{product.compare_at_price && <del>{priceLabel(product.compare_at_price.amount, product.compare_at_price.currency, product.compare_at_price.position, product.compare_at_price.symbol)}</del>}</p>
              {product.variants.length > 1 && <small className="product-card-variant-count">{product.variants.length} pilihan ukuran</small>}
            </Link>
            {quickAdd
              ? <button type="button" className="product-add-button product-quick-add" aria-label={`Tambah ${product.name} ke keranjang`} onClick={(event) => { addTriggerRef.current = event.currentTarget; setActiveProduct(product); }}><Image src={homeAssets.icons.plus} alt="" width={12} height={12} /></button>
              : <Link className="product-card-open" href={detailHref}>Lihat detail <span aria-hidden="true">→</span></Link>}
          </div>
        </article>;
      })}
    </div>
    {quickAdd && activeProduct && <AddToCartSheet product={activeProduct} triggerRef={addTriggerRef} onClose={closeSheet} onAdded={handleAdded} />}
    {addedNotice && <div key={addedNotice.id} className="cart-add-toast" role="status" aria-live="polite"><span className="cart-add-toast-icon" aria-hidden="true">✓</span><span className="cart-add-toast-copy">{addedNotice.message}<small>Keranjang sudah diperbarui.</small></span><Link href="/cart">Lihat keranjang</Link></div>}
    {addedNotice && typeof document !== "undefined" && createPortal(<div key={addedNotice.id} className="cart-success-overlay" onClick={() => setAddedNotice(null)}>
      <section className="cart-success-dialog" role="status" aria-live="polite" onClick={(event) => event.stopPropagation()}>
        <span className="cart-add-toast-icon" aria-hidden="true">✓</span>
        <span className="cart-add-toast-copy">{addedNotice.message}<small>Keranjang sudah diperbarui.</small></span>
        <Link href="/cart">Lihat keranjang</Link>
      </section>
    </div>, document.body)}
  </>;
}
