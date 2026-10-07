import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart/cart-view";
import { BackChevron } from "@/components/product/back-chevron";
import { getCustomerCart } from "@/lib/account-data";

export const metadata: Metadata = { title: "Keranjang" };

export default async function CartPage() {
  const cart = await getCustomerCart();
  return <main className="cart-page ds-cart-page"><div className="ds-page-title"><Link href="/home" aria-label="Kembali ke beranda"><BackChevron /></Link><h1>Keranjang saya</h1><span /></div><CartView initialCart={cart} /></main>;
}
