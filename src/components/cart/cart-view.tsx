"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { CartSnapshot } from "@/types/store";
import { moneyLabel, storeApi } from "@/lib/store-api";
import { productPhoto } from "@/lib/product-photo";

export function CartView({ initialCart }: { initialCart: CartSnapshot | null }) {
  const [cart, setCart] = useState<CartSnapshot | null>(initialCart);
  const [error, setError] = useState("");
  const [pendingLine, setPendingLine] = useState<number | null>(null);

  async function update(lineId: number, quantity: number) {
    setPendingLine(lineId);
    try {
      const updated = await storeApi<CartSnapshot>(`cart/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
      setCart(updated);
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: updated.quantity }));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Perubahan belum berhasil.");
    } finally { setPendingLine(null); }
  }

  async function saveNote(lineId: number, note: string, previous: string) {
    if (note.trim() === previous.trim()) return;
    try { setCart(await storeApi<CartSnapshot>(`cart/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ note: note.trim() }) })); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Catatan belum tersimpan."); }
  }

  if (error && !cart) return <div className="catalog-empty"><h2>Keranjang belum tersedia.</h2><p>{error}</p></div>;
  if (!cart) return <div className="catalog-empty"><h2>Keranjang belum tersedia.</h2><p>Coba muat ulang halaman.</p></div>;
  if (!cart.lines.length) return <div className="ds-cart-empty"><svg className="ds-cart-mascot" viewBox="0 0 150 130" role="img" aria-label="Keranjang belanja kosong"><path d="M27 43h96l-8 56H44L27 43Z" fill="#f8f8f2" stroke="#0e4c3d" strokeWidth="5" strokeLinejoin="round"/><path d="m22 27 12 4 10 49m67-37 8-14m-64 15 9 20m27-20 1 20" fill="none" stroke="#0e4c3d" strokeWidth="5" strokeLinecap="round"/><circle cx="57" cy="66" r="8" fill="#f3cf6d"/><circle cx="80" cy="60" r="8" fill="#f3cf6d"/><circle cx="102" cy="67" r="8" fill="#f3cf6d"/><path d="M68 83q8 7 16 0" fill="none" stroke="#0e4c3d" strokeWidth="3" strokeLinecap="round"/><path d="M48 105h53m-43 0-4 11m37-11 4 11" fill="none" stroke="#0e4c3d" strokeWidth="5" strokeLinecap="round"/><path d="M68 25q-1-12 9-18m4 17q5-14 18-11" fill="none" stroke="#0e4c3d" strokeWidth="4" strokeLinecap="round"/></svg><h2>Keranjangmu masih kosong</h2><p>Yuk, isi dengan kebutuhan dapur favoritmu!</p><Link href="/home" className="primary-button">Mulai Berbelanja <span>🛒</span></Link></div>;

  return <div className="cart-layout"><section className="cart-lines"><p className="eyebrow"><span /> {cart.quantity} ITEM DI KERANJANG</p>
    {cart.lines.map((line) => <article className="cart-line" key={line.id}>
      <Image unoptimized src={productPhoto(line.product.name, line.product.image)} alt={line.product.name} width={82} height={82} />
      <div className="cart-line-info"><Link href={`/products/${line.product.slug}`}>{line.product.name}</Link><span>{line.variant_name || "Standar"} · {moneyLabel(line.unit_price)}</span><input className="line-note" aria-label={`Catatan untuk ${line.product.name}`} defaultValue={line.note ?? ""} maxLength={200} placeholder="Catatan untuk petugas, mis. ikan dibersihkan" onBlur={(event) => void saveNote(line.id, event.target.value, line.note ?? "")} /><button type="button" disabled={pendingLine === line.id} onClick={() => void update(line.id, 0)}>Hapus</button></div>
      <div className="quantity-control"><button type="button" aria-label="Kurangi jumlah" disabled={pendingLine === line.id} onClick={() => void update(line.id, line.quantity - 1)}>−</button><span>{pendingLine === line.id ? "…" : line.quantity}</span><button type="button" aria-label="Tambah jumlah" disabled={pendingLine === line.id} onClick={() => void update(line.id, line.quantity + 1)}>＋</button></div>
      <strong>{moneyLabel(line.total)}</strong>
    </article>)}
    {error && <p role="alert">{error}</p>}
    <Link className="text-link" href="/products">← Lanjut belanja</Link>
  </section>
  {cart.totals && <aside className="cart-summary"><h2>Ringkasan belanja</h2><div><span>Subtotal</span><span>{moneyLabel(cart.totals.subtotal)}</span></div><div><span>Pajak</span><span>{moneyLabel(cart.totals.tax)}</span></div><div><span>Pengiriman</span><span>{moneyLabel(cart.totals.shipping)}</span></div><div className="summary-total"><span>Total sementara</span><strong>{moneyLabel(cart.totals.total)}</strong></div><Link href="/checkout" className="primary-button">Lanjut checkout <span>↗</span></Link><p>Total dan ketersediaan stok dikonfirmasi kembali saat checkout. Barang timbangan: berat akhir bisa sedikit berbeda.</p></aside>}
  </div>;
}
