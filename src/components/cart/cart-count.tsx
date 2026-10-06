"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CartSnapshot } from "@/types/store";
import { storeApi } from "@/lib/store-api";

function useCartItemCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    void storeApi<CartSnapshot>("cart").then((cart) => { if (active) setCount(cart.lines.length); }).catch(() => undefined);
    const update = (event: Event) => {
      const nextCount = (event as CustomEvent<number>).detail;
      if (typeof nextCount === "number") setCount(nextCount);
    };
    window.addEventListener("dsayur:cart-updated", update);
    return () => { active = false; window.removeEventListener("dsayur:cart-updated", update); };
  }, []);
  return count;
}

export function CartBadge() {
  const count = useCartItemCount();
  return count > 0 ? <b className="nav-badge" aria-label={`${count} jenis item di keranjang`}>{count > 99 ? "99+" : count}</b> : null;
}

export function CartCount() {
  const count = useCartItemCount();
  return <Link className="cart-link" href="/cart"><span aria-hidden="true">♧</span> Keranjang <b className="cart-count" aria-label={`${count} jenis item di keranjang`}>{count}</b></Link>;
}
