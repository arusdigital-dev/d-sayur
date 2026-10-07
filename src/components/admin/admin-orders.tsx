"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";

type ManagedOrder = { id: number; order_number: string; status: string; progress_status: string; payment_status: string; payment_provider_code?: string; total: number; created_at: string; customer_name: string; cancellation_requested_at?: string | null; cancellation_reason?: string };

export function AdminOrders() {
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { setOrders(await storeApi<ManagedOrder[]>("admin/orders")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan tidak dapat dimuat."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const price = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
  async function run(path: string, success: string, fallback: string) {
    setError(""); setNotice("");
    try { await storeApi(path, { method: "POST", body: "{}" }); setNotice(success); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : fallback); }
  }
  async function completePickup(orderId: number) {
    try { await storeApi(`admin/orders/${orderId}/pickup-complete`, { method: "POST", body: "{}" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan pickup belum dapat diselesaikan."); }
  }

  return <section>
    <div className="admin-section-nav"><Link href="/admin/products">Produk &amp; stok</Link><Link aria-current="page" href="/admin/orders">Pesanan</Link></div>
    <div className="admin-tools"><button className="secondary-button" type="button" onClick={() => void run("admin/tiers/review", "Evaluasi tier selesai: tier naik/turun sudah dihitung ulang dari belanja bulan lalu.", "Evaluasi tier belum berhasil.")}>Jalankan evaluasi tier (demo)</button><span className="muted-copy">Memicu evaluasi turun-tier yang biasanya berjalan otomatis tiap tanggal 1.</span></div>
    {notice && <p className="muted-copy" role="status">{notice}</p>}
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {loading ? <p className="muted-copy">Memuat pesanan…</p> : orders.length ? <div className="admin-orders">
      <div className="admin-order-row admin-orders-head"><span>Order</span><span>Pelanggan</span><span>Total</span><span>Pembayaran</span><span>Status Odoo</span></div>
      {orders.map((order) => <div className="admin-order-row" key={order.id}>
        <strong>{order.order_number}<small className="admin-orders-state">{new Date(order.created_at).toLocaleDateString("id-ID")}</small></strong>
        <span>{order.customer_name}</span><strong>{price(order.total)}</strong><span>{order.payment_status}</span><span>{order.progress_status}{order.cancellation_requested_at && <small className="admin-cancellation-request">Permintaan batal · {order.cancellation_reason || "tanpa alasan"}</small>}<span className="admin-order-actions">{order.progress_status === "pending_payment" && order.payment_provider_code === "custom" && order.payment_status === "pending" && <button className="secondary-button" type="button" onClick={() => void run(`admin/orders/${order.id}/confirm-payment`, `Pembayaran ${order.order_number} dikonfirmasi.`, "Pembayaran belum dapat dikonfirmasi.")}>Konfirmasi pembayaran</button>}{order.progress_status === "paid" && <button className="secondary-button" type="button" onClick={() => void run(`admin/orders/${order.id}/start-packing`, `Packing ${order.order_number} dimulai.`, "Packing belum dapat dimulai.")}>Mulai packing</button>}{order.progress_status === "ready_pickup" && <button className="secondary-button" type="button" onClick={() => void completePickup(order.id)}>Tandai diambil</button>}</span></span>
      </div>)}
    </div> : <div className="catalog-empty"><h2>Belum ada pesanan.</h2><p>Pesanan pelanggan akan muncul di sini setelah checkout.</p></div>}
    <p className="muted-copy">Alur: Menunggu bayar → Dibayar → Dipacking (tombol di sini) → Dikirim (validasi delivery order di Inventory Odoo) → Selesai (pembeli menekan &quot;Pesanan diterima&quot; atau otomatis 24 jam).</p>
  </section>;
}
