"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { CartSnapshot, ProductVariant, StoreProduct } from "@/types/store";
import { storeApi } from "@/lib/store-api";
import { storefrontProductPhoto } from "@/lib/product-photo";
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
  const [message, setMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const openSheet = (product: StoreProduct) => {
    setSelectedProduct(product);
    setVariantId(product.variants.find((variant) => variant.available)?.id ?? product.variants[0]?.id ?? null);
    setQuantity(1);
    setMessage("");
  };
  const selectedVariant: ProductVariant | undefined = selectedProduct?.variants.find((variant) => variant.id === variantId);

  async function add() {
    if (!selectedProduct || !selectedVariant?.available || pending) return;
    setPending(true);
    setMessage("");
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: selectedVariant.id, quantity }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.quantity }));
      setSelectedProduct(null);
      setMessage(`${selectedProduct.name} ditambahkan ke keranjang.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Koneksi sedang bermasalah. Silakan coba lagi.");
    } finally { setPending(false); }
  }

  return <>
    <div className="product-grid">{products.map((product) => {
      const stock = stockDisplay(product);
      return <article className="product-card" key={product.id}>
      <div className="product-media"><Link href={`/products/${product.slug}`} className="product-image"><Image unoptimized fill sizes="(max-width: 560px) 45vw, (max-width: 850px) 42vw, 24vw" src={storefrontProductPhoto(product)} alt={product.images[0]?.alt ?? product.name} /><BadgeLabel product={product} /></Link><button type="button" className={`product-favorite${favorites.includes(product.id) ? " is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? `Hapus ${product.name} dari favorit` : `Simpan ${product.name} ke favorit`} aria-pressed={favorites.includes(product.id)} onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}>{favorites.includes(product.id) ? "♥" : "♡"}</button></div>
      <div className="product-card-copy"><div className="product-card-info"><Link href={`/products/${product.slug}`}><h2>{product.name}{product.unit_label && <span className="product-card-unit">{product.unit_label}</span>}</h2></Link><p className={`product-stock${stock.inStock ? " is-available" : " is-empty"}`}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m2 5 6-3 6 3v6l-6 3-6-3V5Z"/><path d="m2 5 6 3 6-3M8 8v6M5 3.5l6 3"/></svg>{stock.label}</p><p className="product-price">{priceLabel(product.price.amount, product.price.currency, product.price.position, product.price.symbol)}</p></div><button type="button" className="product-add-button" aria-label={`Pilih ${product.name}`} onClick={() => openSheet(product)} disabled={!product.available}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button></div>
    </article>;
    })}</div>
    <p className="cart-feedback" role="status" aria-live="polite">{message}</p>
    {selectedProduct && <div className="quick-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setSelectedProduct(null); }}>
      <section className="quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-sheet-title">
        <header><h2 id="quick-sheet-title">Tambah item</h2><button type="button" aria-label="Tutup" disabled={pending} onClick={() => setSelectedProduct(null)}>×</button></header>
        <div className="quick-sheet-product"><Image unoptimized src={storefrontProductPhoto(selectedProduct)} alt={selectedProduct.name} width={76} height={76} /><div><strong>{selectedProduct.name}</strong><small>{selectedProduct.unit_label ?? selectedVariant?.name ?? "Produk segar"}</small><b>{selectedVariant ? priceLabel(selectedVariant.price.amount, selectedVariant.price.currency, selectedVariant.price.position, selectedVariant.price.symbol) : "Stok habis"}</b></div><div className="quick-sheet-quantity"><button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1 || pending} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><span>{quantity}</span><button type="button" aria-label="Tambah jumlah" disabled={pending} onClick={() => setQuantity((value) => value + 1)}>＋</button></div></div>
        {selectedProduct.variants.length > 1 && <div className="quick-sheet-variants"><p>Pilih Varian Satuan</p>{selectedProduct.variants.map((variant) => <button key={variant.id} type="button" className={variant.id === variantId ? "selected" : ""} disabled={!variant.available} onClick={() => setVariantId(variant.id)}>{variant.name}</button>)}</div>}
        {message && <p role="alert" className="quick-sheet-error">{message}</p>}
        <footer><Link href={`/products/${selectedProduct.slug}`}>Lihat detail produk</Link><button type="button" disabled={!selectedVariant?.available || pending} onClick={() => void add()}>{pending ? "Menambahkan…" : "Masukkan keranjang"}<span aria-hidden="true">🛒</span></button></footer>
      </section>
    </div>}
  </>;
}
