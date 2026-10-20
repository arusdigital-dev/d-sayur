"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { CartSnapshot } from "@/types/store";
import { storeApi } from "@/lib/store-api";

let cachedCount = 0;
let cartLoaded = false;
let cartRequest: Promise<void> | null = null;
let cartRevision = 0;
let cartNeedsReload = false;
const countSubscribers = new Set<() => void>();
let browserListenersBound = false;

function publishCartCount(count: number) {
  cartRevision += 1;
  cachedCount = Math.max(0, count);
  cartLoaded = true;
  countSubscribers.forEach((notify) => notify());
}

function loadCartCount() {
  if (cartLoaded || cartRequest) return;
  const revision = cartRevision;
  cartRequest = storeApi<CartSnapshot>("cart")
    .then((cart) => { if (revision === cartRevision) publishCartCount(cart.quantity); })
    .catch(() => undefined)
    .finally(() => {
      cartRequest = null;
      if (cartNeedsReload) { cartNeedsReload = false; loadCartCount(); }
    });
}

function onCartUpdated(event: Event) {
  const nextCount = (event as CustomEvent<number>).detail;
  if (typeof nextCount === "number") publishCartCount(nextCount);
  else { cartLoaded = false; loadCartCount(); }
}

function onAuthChanged() {
  cartRevision += 1;
  cachedCount = 0;
  cartLoaded = false;
  countSubscribers.forEach((notify) => notify());
  if (cartRequest) cartNeedsReload = true;
  else loadCartCount();
}

function subscribeCartCount(notify: () => void) {
  countSubscribers.add(notify);
  if (!browserListenersBound) {
    window.addEventListener("dsayur:cart-updated", onCartUpdated);
    window.addEventListener("dsayur:auth-changed", onAuthChanged);
    browserListenersBound = true;
  }
  loadCartCount();
  return () => {
    countSubscribers.delete(notify);
    if (!countSubscribers.size && browserListenersBound) {
      window.removeEventListener("dsayur:cart-updated", onCartUpdated);
      window.removeEventListener("dsayur:auth-changed", onAuthChanged);
      browserListenersBound = false;
    }
  };
}

function useCartItemCount() {
  return useSyncExternalStore(subscribeCartCount, () => cachedCount, () => 0);
}

export function CartBadge({ className = "nav-badge" }: { className?: string }) {
  const count = useCartItemCount();
  return count > 0 ? <b className={className} aria-label={`${count} item di keranjang`}>{count > 99 ? "99+" : count}</b> : null;
}

export function CartCount() {
  const count = useCartItemCount();
  return <Link className="cart-link" href="/cart"><span aria-hidden="true">♧</span> Keranjang <b className="cart-count" aria-label={`${count} jenis item di keranjang`}>{count}</b></Link>;
}
