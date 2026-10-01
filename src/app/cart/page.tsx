import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getCustomerCart } from "@/lib/account-data";

export const metadata: Metadata = { title: "Keranjang" };

export default async function CartPage() {
  const cart = await getCustomerCart();
  return <main className="cart-page"><div className="catalog-heading"><div className="eyebrow"><span /> PESANANMU</div><h1>Keranjang <em>belanja.</em></h1></div><CartView initialCart={cart} /></main>;
}
