"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { CartSnapshot, ProductVariant, StoreProduct } from "@/types/store";
import { homeAssets } from "@/config/home-assets";
import { storefrontProductPhoto } from "@/lib/product-photo";
import { storeApi } from "@/lib/store-api";
import styles from "./add-to-cart-sheet.module.css";

type Props = {
  product: StoreProduct | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onAdded: (product: StoreProduct, quantity: number, cart: CartSnapshot) => void;
};

function moneyLabel(variant: ProductVariant) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: variant.price.currency, maximumFractionDigits: 0 }).format(variant.price.amount);
}

function variantLabel(product: StoreProduct, variant: ProductVariant) {
  const normalizedProductName = product.name.trim().toLocaleLowerCase("id-ID");
  const values = variant.attributes.map((attribute) => attribute.value).filter((value) => value && value.trim().toLocaleLowerCase("id-ID") !== normalizedProductName).join(" · ");
  const variantSuffix = variant.name.trim().toLocaleLowerCase("id-ID").startsWith(normalizedProductName)
    ? variant.name.trim().slice(product.name.trim().length).trim()
    : variant.name.trim();
  return values || variantSuffix || product.unit_label || "Standar";
}

export function AddToCartSheet({ product, triggerRef, onClose, onAdded }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [desktopFrame, setDesktopFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const variants = useMemo<ProductVariant[]>(() => {
    if (!product) return [];
    return product.variants.length ? product.variants : [{ id: product.id, name: product.name, attributes: [], price: product.price, available: product.available, stock_on_hand: product.stock_on_hand }];
  }, [product]);
  const [variantId, setVariantId] = useState<number | null>(() => (variants.find((variant) => variant.available) ?? variants[0])?.id ?? null);

  useEffect(() => {
    if (!product) return;
    const triggerElement = triggerRef.current;
    const bodyOverflow = document.body.style.overflow;
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const shellOverflow = shell?.style.overflowY;
    const updateFrame = () => {
      if (window.matchMedia("(min-width: 701px)").matches && shell) {
        const { left, top, width, height } = shell.getBoundingClientRect();
        setDesktopFrame({ left, top, width, height });
      } else {
        setDesktopFrame(null);
      }
    };
    updateFrame();
    window.addEventListener("resize", updateFrame);
    document.body.style.overflow = "hidden";
    if (shell && getComputedStyle(shell).overflowY !== "visible") shell.style.overflowY = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      if (shell) shell.style.overflowY = shellOverflow ?? "";
      triggerElement?.focus();
    };
  }, [onClose, product, triggerRef]);

  if (!product || typeof document === "undefined") return null;
  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0];
  if (!selected) return null;
  const stock = selected.stock_on_hand ?? (variants.length === 1 ? product.stock_on_hand : undefined);
  const maxQuantity = typeof stock === "number" && stock > 0 ? Math.min(100, Math.floor(stock)) : selected.available ? 100 : 0;
  const canAdd = selected.available && maxQuantity > 0;
  const stockText = typeof stock === "number" ? stock > 0 ? `Tersedia ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(stock)} ${product.unit_label || "unit"}` : selected.available ? "Pre-order tersedia" : "Stok habis" : selected.available ? "Tersedia" : "Stok habis";
  const frameOverlayStyle: CSSProperties | undefined = desktopFrame ? {
    left: desktopFrame.left,
    top: desktopFrame.top,
    width: desktopFrame.width,
    height: desktopFrame.height,
    right: "auto",
    bottom: "auto",
  } : undefined;

  async function addToCart() {
    if (!product || !canAdd || pending || quantity > maxQuantity) return;
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>("cart/lines", { method: "POST", body: JSON.stringify({ product_id: selected.id, quantity }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.quantity }));
      onAdded(product, quantity, cart);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Produk belum dapat ditambahkan. Coba lagi.");
    } finally { setPending(false); }
  }

  return createPortal(<div className={`${styles.overlay}${desktopFrame ? ` ${styles.frameOverlay}` : ""}`} style={frameOverlayStyle} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.dialog} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="add-product-title" tabIndex={-1}>
      <aside className={styles.shippingInfo}>
        <Image src={homeAssets.icons.discount} alt="" width={48} height={48} />
        <span><strong>Diskon ongkir 10rb</strong><small>Diskon terbaik untukmu</small></span>
        <Link href="/checkout" className={styles.voucherAction}>Pakai</Link>
      </aside>

      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 id="add-product-title">Keranjang belanja</h2>
          <button className={styles.close} type="button" ref={closeRef} aria-label="Tutup panel" onClick={onClose}>×</button>
        </header>

        <div className={styles.content}>
          <article className={styles.product}>
            <div className={styles.productImage}><Image src={storefrontProductPhoto(product)} alt={product.images[0]?.alt ?? product.name} fill sizes="106px" unoptimized /></div>
            <div className={styles.productCopy}>
              <div className={styles.productTitle}><h3>{product.name}</h3><span>{variantLabel(product, selected)}</span></div>
              <p>{product.unit_label || `${variantLabel(product, selected)} / pack`}</p>
              <strong>{moneyLabel(selected)}</strong>
              <small className={canAdd ? styles.available : styles.unavailable}>{stockText}</small>
            </div>
          </article>

          <div className={`${styles.optionsRow}${variants.length < 2 ? ` ${styles.optionsSingle}` : ""}`}>
            {variants.length > 1 && <fieldset className={styles.variants}>
              <legend>Pilih Varian Satuan</legend>
              <div className={styles.variantOptions}>{variants.map((variant) => {
                const label = variantLabel(product, variant);
                const isSelected = variant.id === selected.id;
                return <button type="button" key={variant.id} className={isSelected ? styles.variantSelected : styles.variantOption} aria-pressed={isSelected} disabled={!variant.available || pending} onClick={() => { setVariantId(variant.id); setQuantity(1); setError(""); }}>
                  <span>{label}</span><span className={styles.variantPrice}>{moneyLabel(variant)}</span>
                </button>;
              })}</div>
            </fieldset>}

            <div className={styles.stepper} aria-label="Pilih jumlah">
              <button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1 || pending} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
              <output aria-live="polite">{quantity}</output>
              <button type="button" aria-label="Tambah jumlah" disabled={!canAdd || quantity >= maxQuantity || pending} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>+</button>
            </div>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <footer className={styles.footer}>
          <p className={styles.subtotal}>Subtotal <strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: selected.price.currency, maximumFractionDigits: 0 }).format(selected.price.amount * quantity)}</strong></p>
          <div className={styles.footerActions}>
            <Link className={styles.detailButton} href={`/products/${product.slug}`} onClick={onClose}>Lihat detail produk</Link>
            <button className={styles.confirm} type="button" disabled={!canAdd || pending || quantity > maxQuantity} onClick={() => void addToCart()}>
              <span>{pending ? "Menambahkan…" : canAdd ? "Masukkan keranjang" : "Stok habis"}</span>
              <Image src={homeAssets.icons.cart} alt="" width={18} height={18} />
            </button>
          </div>
        </footer>
      </div>
    </section>
  </div>, document.body);
}
