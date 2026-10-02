import "server-only";
import { customerData } from "@/lib/odoo/customer";
import type { CartSnapshot, CheckoutSnapshot } from "@/types/store";

export type Customer = { id: number; name: string; email: string; phone: string; is_admin?: boolean };
export type LoyaltySnapshot = { tier: "bronze" | "silver" | "gold"; tier_valid_until: string | null; month_spend: number; next_tier_spend: number | null; spend_to_next_tier: number; points_multiplier: number; free_shipping_minimum: number; gold_discount_percent: number; cards: Array<{ id: number; code: string; points: number; point_value: number }>; early_access_promos: Array<{ name: string; minimum_tier: "silver" | "gold"; starts_at: string | null; ends_at: string | null; codes: string[] }>; tiers: Array<{ tier: "bronze" | "silver" | "gold"; min_spend: number; points_multiplier: number; free_shipping_minimum: number; discount_percent: number; perks: string }>; history: Array<{ description: string; points: number; date: string }> };
export type StoreOrder = { id: number; name: string; date: string; status: string; progress_status?: string; total: { amount: number; currency: string; symbol: string; position: "before" | "after" } };
export type StoreOrderDetail = Omit<StoreOrder, "total"> & {
  payment_status: string;
  payment_method: string;
  payment_instructions: string;
  progress_status: "pending_payment" | "paid" | "packing" | "delivered" | "ready_pickup" | "completed" | "cancelled";
  can_confirm_received: boolean;
  fulfillment: Array<{ reference: string; status: string; scheduled_date: string | null; completed_date: string | null }>;
  cart: CartSnapshot;
};
type CustomerEnvelope = { logged_in: boolean; customer: Customer | null };

export async function getCustomer() {
  try { return await customerData<CustomerEnvelope>("/dsayur/api/auth/me"); }
  catch { return { logged_in: false, customer: null }; }
}

export async function getLoyalty() {
  try { return await customerData<LoyaltySnapshot>("/dsayur/api/loyalty"); }
  catch { return null; }
}

export async function getOrders() {
  try { return await customerData<StoreOrder[]>("/dsayur/api/orders"); }
  catch { return null; }
}

export async function getOrder(orderId: string) {
  if (!/^\d+$/.test(orderId)) return null;
  try { return await customerData<StoreOrderDetail>(`/dsayur/api/orders/${encodeURIComponent(orderId)}`); }
  catch { return null; }
}

export async function getCustomerCart() {
  try { return await customerData<CartSnapshot>("/dsayur/api/cart"); }
  catch { return null; }
}

export async function getCheckoutSnapshot() {
  const customer = await getCustomer();
  if (!customer.logged_in) return null;
  return customerData<CheckoutSnapshot>("/dsayur/api/checkout");
}
