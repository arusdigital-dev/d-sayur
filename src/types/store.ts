/** Shared API and model shapes for the D-Sayur-owned PostgreSQL backend. */
export type ProductImage = { url: string; alt: string };
export type Money = { amount: number; currency: string; symbol: string; position: "before" | "after" };
export type ProductVariant = { id: number; name: string; attributes: Array<{ name: string; value: string }>; price: Money; available: boolean };
export type StoreProduct = { id: number; slug: string; name: string; description: string; price: Money; images: ProductImage[]; category: { id: number; slug: string; name: string } | null; variants: ProductVariant[]; available: boolean };
export type StoreCategory = { id: number; slug: string; name: string; image?: string };
export type CartSnapshot = {
  id: string | null;
  lines: Array<{ id: number; product: { id: number; name: string; slug: string; image: string }; variant_name?: string; quantity: number; unit_price: Money; subtotal: Money; tax: Money; total: Money }>;
  quantity: number;
  totals: null | { subtotal: Money; tax: Money; shipping: Money; total: Money };
};
export type ApiEnvelope<T> = { success: true; data: T };
export type CheckoutSnapshot = {
  cart: CartSnapshot;
  addresses: Array<{ id: number; name: string; street: string; street2: string; city: string; zip: string; phone: string; country_id: number; country: string; state_id: number | false }>;
  delivery_methods: Array<{ id: number; name: string; price: Money }>;
  countries: Array<{ id: number; name: string; code: string }>;
};
export type PaymentOptions = { providers: Array<{ id: number; name: string; code: string; flow: "redirect"; methods: Array<{ id: number; name: string }> }> };
