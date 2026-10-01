"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";

type ManagedOrder = { id: number; order_number: string; status: string; payment_status: string; payment_method: string; total: number; created_at: string; customer_name: string };
const statuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"];

export function AdminOrders() {
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setOrders(await storeApi<ManagedOrder[]>("admin/orders")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan tidak dapat dimuat."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function changeStatus(id: number, status: string) {
    try {
      const updated = await storeApi<Pick<ManagedOrder,"id"|"status">>(`admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((items) => items.map((item) => item.id === id ? { ...item, status: updated.status } : item));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Status belum dapat disimpan."); }
  }
  const price = (value:number) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value);
  return <section><div className="admin-section-nav"><Link href="/admin/products">Produk &amp; stok</Link><Link aria-current="page" href="/admin/orders">Pesanan</Link></div>{error && <p className="admin-alert" role="alert">{error}</p>}{loading ? <p className="muted-copy">Memuat pesanan…</p> : orders.length ? <div className="admin-orders"><div className="admin-order-row admin-orders-head"><span>Order</span><span>Pelanggan</span><span>Total</span><span>Pembayaran</span><span>Status</span></div>{orders.map((order)=><div className="admin-order-row" key={order.id}><strong>{order.order_number}<small className="admin-orders-state">{new Date(order.created_at).toLocaleDateString("id-ID")}</small></strong><span>{order.customer_name}</span><strong>{price(order.total)}</strong><span>{order.payment_method.toUpperCase()} · {order.payment_status}</span><select aria-label={`Status ${order.order_number}`} value={order.status} onChange={(event)=>void changeStatus(order.id,event.target.value)}>{statuses.map((status)=><option key={status} value={status}>{status}</option>)}</select></div>)}</div> : <div className="catalog-empty"><h2>Belum ada pesanan.</h2><p>Pesanan pelanggan akan muncul di sini setelah checkout.</p></div>}</section>;
}
