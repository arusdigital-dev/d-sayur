"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartBadge } from "@/components/cart/cart-count";

const icon = (path: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const items = [
  { href: "/", label: "Beranda", match: (path: string) => path === "/", svg: icon("M3 11.5 12 4l9 7.5M5.5 10v10h13V10") },
  { href: "/categories", label: "Kategori", match: (path: string) => path.startsWith("/categories") || path.startsWith("/products"), svg: icon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z") },
  { href: "/cart", label: "Keranjang", match: (path: string) => path.startsWith("/cart") || path.startsWith("/checkout"), svg: icon("M5 7h14l-1.5 11h-11zM9 7a3 3 0 0 1 6 0"), cart: true },
  { href: "/account/orders", label: "Pesanan", match: (path: string) => path.startsWith("/account/orders") || path.startsWith("/order-confirmation"), svg: icon("M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6") },
  { href: "/account", label: "Akun", match: (path: string) => path === "/account" || path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/admin"), svg: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0") },
];

export function BottomNav() {
  const path = usePathname();
  return <nav className="bottom-nav" aria-label="Navigasi utama">{items.map((item) => <Link href={item.href} key={item.href} aria-current={item.match(path) ? "page" : undefined}>{item.svg}<span>{item.label}</span>{item.cart && <CartBadge />}</Link>)}</nav>;
}
