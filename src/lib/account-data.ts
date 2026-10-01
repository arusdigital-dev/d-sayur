import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { getCart, ensureCart } from "@/lib/storefront";
import type { CartSnapshot } from "@/types/store";

export type Customer = { id: number; name: string; email: string; phone: string };
export type StoreOrder = { id: number; name: string; date: string; status: string; total: { amount: number; currency: string; symbol: string; position: "before" | "after" } };
export type StoreOrderDetail = Omit<StoreOrder, "total"> & { payment_status: string; cart: CartSnapshot };

async function currentCustomer() {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

export async function getCustomer() {
  const user = await currentCustomer();
  return { logged_in: Boolean(user), customer: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, is_admin: user.role === "admin" } : null };
}

export async function getOrders() {
  const user = await currentCustomer();
  if (!user) return null;
  const rows = await db.query<{ id: number; order_number: string; created_at: Date; status: string; total: string }>(
    "SELECT id,order_number,created_at,status,total::text FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100", [user.id]);
  return rows.rows.map((order) => ({ id: order.id, name: order.order_number, date: order.created_at.toISOString(), status: order.status, total: { amount: Number(order.total), currency: "IDR", symbol: "Rp", position: "before" as const } }));
}

export async function getOrder(orderId: string) {
  const user = await currentCustomer();
  if (!user || !/^\d+$/.test(orderId)) return null;
  return getOrderForUser(Number(orderId), user.id);
}

export async function getOrderForUser(orderId: number, customerId: number) {
  const result = await db.query<{ id: number; order_number: string; created_at: Date; status: string; payment_status: string; subtotal: string; discount: string; tax: string; shipping: string; total: string; lines: Array<{ product_id: number; product_name: string; variant_name: string; quantity: number; unit_price: string; tax: string; total: string }> }>(
    `SELECT o.*, COALESCE(json_agg(json_build_object(
       'product_id',ol.product_id,'product_name',ol.product_name,'variant_name',ol.variant_name,
       'quantity',ol.quantity,'unit_price',ol.unit_price,'tax',ol.tax,'total',ol.total
     )) FILTER (WHERE ol.id IS NOT NULL),'[]') AS lines
     FROM orders o LEFT JOIN order_lines ol ON ol.order_id=o.id
     WHERE o.id=$1 AND o.customer_id=$2 GROUP BY o.id`, [orderId, customerId]);
  const order = result.rows[0];
  if (!order) return null;
  const money = (value: string | number) => ({ amount: Number(value), currency: "IDR", symbol: "Rp", position: "before" as const });
  const lines = order.lines.map((line, index) => ({ id: index + 1, product: { id: line.product_id ?? 0, name: line.product_name, slug: "", image: "/placeholder.svg" }, quantity: line.quantity, unit_price: money(line.unit_price), subtotal: money(Number(line.unit_price) * line.quantity), tax: money(line.tax), total: money(line.total) }));
  return {
    id: order.id, name: order.order_number, date: order.created_at.toISOString(), status: order.status,
    payment_status: order.payment_status,
    cart: { id: null, lines, quantity: lines.reduce((sum, line) => sum + line.quantity, 0), totals: { subtotal: money(order.subtotal), tax: money(order.tax), shipping: money(order.shipping), total: money(order.total) } },
  } as StoreOrderDetail;
}

export async function getCustomerCart(): Promise<CartSnapshot | null> {
  const jar = await cookies();
  const user = await currentCustomer();
  const id = await ensureCart(jar.get("dsayur_cart")?.value, user?.id);
  return getCart(id);
}

export async function getCheckoutSnapshot() {
  const user = await currentCustomer();
  if (!user) return null;
  const jar = await cookies();
  const cartId = await ensureCart(jar.get("dsayur_cart")?.value, user.id);
  const [cart, addresses, methods] = await Promise.all([
    getCart(cartId),
    db.query<{ id: number; name: string; street: string; street2: string; city: string; zip: string; phone: string }>("SELECT id,name,street,street2,city,zip,phone FROM addresses WHERE customer_id=$1 ORDER BY id DESC", [user.id]),
    db.query<{ id: number; name: string; price: string }>("SELECT id,name,price::text FROM shipping_methods WHERE active ORDER BY price,name"),
  ]);
  return {
    cart,
    addresses: addresses.rows.map((address) => ({ ...address, country_id: 1, country: "Indonesia", state_id: false as const })),
    delivery_methods: methods.rows.map((method) => ({ id: method.id, name: method.name, price: { amount: Number(method.price), currency: "IDR", symbol: "Rp", position: "before" as const } })),
    countries: [{ id: 1, name: "Indonesia", code: "ID" }],
  };
}
