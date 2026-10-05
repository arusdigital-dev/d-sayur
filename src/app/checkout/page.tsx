import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCheckoutSnapshot } from "@/lib/account-data";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const checkout = await getCheckoutSnapshot();
  return <main className="checkout-page ds-checkout-page"><div className="ds-page-title"><Link href="/cart" aria-label="Kembali ke keranjang">‹</Link><h1>Checkout</h1><span /></div><CheckoutForm initialSnapshot={checkout} /></main>;
}
