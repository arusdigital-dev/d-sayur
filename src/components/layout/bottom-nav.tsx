"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CartBadge } from "@/components/cart/cart-count";

const icon = (path: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const items = [
  { href: "/home", label: "Beranda", match: (path: string) => path === "/home" || path === "/" || path === "/area" || path.startsWith("/products"), svg: icon("M3 11.5 12 4l9 7.5M5.5 10v10h13V10") },
  { href: "/categories", label: "Kategori", match: (path: string) => path.startsWith("/categories"), svg: icon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z") },
  { href: "/cart", label: "Keranjang", match: (path: string) => path.startsWith("/cart") || path.startsWith("/checkout"), svg: icon("M2.5 4h2l2.2 11h11.5l2.1-7.5H6M9 20a1 1 0 1 0 0 .1M17 20a1 1 0 1 0 0 .1"), cart: true },
  { href: "/account", label: "Profil", match: (path: string) => path.startsWith("/account") || path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/admin") || path.startsWith("/order-confirmation"), svg: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0") },
];

export function BottomNav() {
  const path = usePathname();
  const [pressedHref, setPressedHref] = useState<string | null>(null);
  const hidden = path.startsWith("/checkout") || /^\/account\/orders\/\d+/.test(path);
  return <nav className={`bottom-nav${hidden ? " is-hidden" : ""}`} aria-label="Navigasi utama">{items.map((item) => <Link
    href={item.href}
    key={item.href}
    className={pressedHref === item.href ? "is-pressed" : undefined}
    aria-current={item.match(path) ? "page" : undefined}
    onClick={() => setPressedHref(item.href)}
    onAnimationEnd={() => setPressedHref((current) => current === item.href ? null : current)}
  >{item.svg}<span>{item.label}</span>{item.cart && <CartBadge />}</Link>)}</nav>;
}
