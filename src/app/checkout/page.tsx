import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCheckoutSnapshot } from "@/lib/account-data";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const checkout = await getCheckoutSnapshot();
  return <main className="checkout-page"><div className="catalog-heading"><div className="eyebrow"><span /> CHECKOUT AMAN</div><h1>Selesaikan <em>pesanan.</em></h1><p>Harga, ongkir, dan stok dikonfirmasi oleh server toko saat pesanan dibuat.</p></div><CheckoutForm initialSnapshot={checkout} /></main>;
}
