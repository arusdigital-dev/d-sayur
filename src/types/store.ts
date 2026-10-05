/** Shared API shapes for the Odoo-backed storefront (all values come from the Odoo addon contract). */
export type ProductImage = { url: string; alt: string };
export type Money = { amount: number; currency: string; symbol: string; position: "before" | "after" };
export type ProductVariant = { id: number; name: string; attributes: Array<{ name: string; value: string }>; price: Money; available: boolean; stock_on_hand?: number };
export type ProductBadge = { code: "harvest_today" | "live_fish" | "ready_to_cook" | "umkm"; label: string };
export type StoreProduct = {
  id: number; slug: string; name: string; description: string; price: Money; images: ProductImage[];
  category: { id: number; slug: string; name: string } | null; variants: ProductVariant[]; available: boolean;
  badge?: ProductBadge | null; unit_label?: string; price_per_kg?: Money | null; weighed?: boolean; stock_on_hand?: number;
  umkm?: { name: string; origin: string; story: string } | null;
};
export type StoreCategory = { id: number; slug: string; name: string; image?: string };
export type CartSnapshot = {
  id: string | null;
  lines: Array<{ id: number; product: { id: number; name: string; slug: string; image: string }; variant_name?: string; quantity: number; note?: string; unit_price: Money; subtotal: Money; tax: Money; total: Money }>;
  quantity: number;
  totals: null | { subtotal: Money; tax: Money; shipping: Money; total: Money };
};
export type ApiEnvelope<T> = { success: true; data: T };
export type CheckoutSnapshot = {
  cart: CartSnapshot;
  addresses: Array<{ id: number; name: string; street: string; street2: string; city: string; zip: string; phone: string; country_id: number; country: string; state_id: number | false; latitude?: number; longitude?: number }>;
  delivery_methods: Array<{ id: number; name: string; price: Money; requires_slot: boolean }>;
  delivery_slots: Array<{ id: number; name: string; start_at: string; end_at: string; remaining: number; priority_tier: "all" | "gold" }>;
  stock_issues: Array<{ line_id: number; product_id: number; name: string; quantity: number; alternatives: Array<{ id: number; name: string; price: Money }> }>;
  loyalty_cards: Array<{ id: number; points: number }>;
  vouchers: Array<{ id: number; name: string; value: number }>;
  countries: Array<{ id: number; name: string; code: string }>;
  substitution_policy: "contact_first" | "similar_ok" | "no_substitute";
  substitution_note: string;
};
export type PaymentOptions = { providers: Array<{ id: number; name: string; code: string; flow: "redirect" | "direct"; methods: Array<{ id: number; name: string }> }> };
export type AreaEstimate = { deliverable: boolean; distance_km: number; fee: number | null; pickup_available: boolean };
export type ReverseGeocodeAddress = {
  label: string; street: string; street2: string; city: string; region: string; zip: string;
  latitude: number; longitude: number;
};
