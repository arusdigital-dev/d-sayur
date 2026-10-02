"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CartSnapshot } from "@/types/store";
import { storeApi } from "@/lib/store-api";

function useCartQuantity() {
  const [quantity, setQuantity] = useState(0);
  useEffect(() => {
    let active = true;
    void storeApi<CartSnapshot>("cart").then((cart) => { if (active) setQuantity(cart.quantity); }).catch(() => undefined);
    const update = (event: Event) => {
      const count = (event as CustomEvent<number>).detail;
      if (typeof count === "number") setQuantity(count);
    };
    window.addEventListener("dsayur:cart-updated", update);
    return () => { active = false; window.removeEventListener("dsayur:cart-updated", update); };
  }, []);
  return quantity;
}

export function CartBadge() {
  const quantity = useCartQuantity();
  return quantity > 0 ? <b className="nav-badge" aria-label={`${quantity} item di keranjang`}>{quantity > 99 ? "99+" : quantity}</b> : null;
}

export function CartCount() {
  const quantity = useCartQuantity();
  return <Link className="cart-link" href="/cart"><span aria-hidden="true">♧</span> Keranjang <b className="cart-count" aria-label={`${quantity} item di keranjang`}>{quantity}</b></Link>;
}
