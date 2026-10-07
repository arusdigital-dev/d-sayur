"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartBadge } from "@/components/cart/cart-count";

const icon = (path: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const categoryIcon = <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="7" r="2.2" /><circle cx="7" cy="17" r="2.2" /><circle cx="17" cy="17" r="2.2" /></svg>;
const items = [
  { href: "/home", label: "Beranda", match: (path: string) => path === "/home" || path === "/" || path === "/area" || path.startsWith("/products"), svg: icon("M3 11.5 12 4l9 7.5M5.5 10v10h13V10") },
  { href: "/categories", label: "Kategori", match: (path: string) => path.startsWith("/categories"), svg: categoryIcon },
  { href: "/cart", label: "Keranjang", match: (path: string) => path.startsWith("/cart") || path.startsWith("/checkout"), svg: icon("M2.5 4h2l2.2 11h11.5l2.1-7.5H6M9 20a1 1 0 1 0 0 .1M17 20a1 1 0 1 0 0 .1"), cart: true },
  { href: "/account", label: "Profil", match: (path: string) => path.startsWith("/account") || path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/admin") || path.startsWith("/order-confirmation"), svg: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0") },
];

export function BottomNav() {
  const path = usePathname();
  const hidden = path.startsWith("/checkout") || path.startsWith("/products/") || /^\/account\/orders\/\d+/.test(path);
  return <nav className={`bottom-nav${hidden ? " is-hidden" : ""}`} aria-label="Navigasi utama">{items.map((item) => <Link
    href={item.href}
    key={item.href}
    aria-current={item.match(path) ? "page" : undefined}
  >{item.svg}<span>{item.label}</span>{item.cart && <CartBadge />}</Link>)}</nav>;
}
