"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { moneyLabel, storeApi } from "@/lib/store-api";
import type { CartSnapshot, CheckoutSnapshot, PaymentOptions } from "@/types/store";

type CompletedOrder = { completed: true; order_id: number; order_number: string };

export function CheckoutForm({ initialSnapshot }: { initialSnapshot: CheckoutSnapshot | null }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(initialSnapshot);
  const [payments, setPayments] = useState<PaymentOptions | null>(null);
  const [addressId, setAddressId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const selected = snapshot?.addresses.find((address) => address.id === Number(addressId));
    try {
      await storeApi("checkout/address", { method: "POST", body: JSON.stringify(selected ? { ...selected, address_id: selected.id } : data) });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat belum dapat disimpan."); }
    finally { setPending(false); }
  }

  async function saveDelivery() {
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>("checkout/delivery", { method: "POST", body: JSON.stringify({ carrier_id: Number(carrierId) }) });
      setSnapshot((current) => current ? { ...current, cart } : current);
      const options = await storeApi<PaymentOptions>("checkout/payment");
      setPayments(options);
      setProviderId(String(options.providers[0]?.id ?? ""));
      setMethodId(String(options.providers[0]?.methods[0]?.id ?? ""));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Metode pengiriman belum dapat dipilih."); }
    finally { setPending(false); }
  }

  async function placeOrder() {
    setPending(true); setError("");
    try {
      const result = await storeApi<CompletedOrder>("checkout/transaction", { method: "POST", body: JSON.stringify({ provider_id: Number(providerId), payment_method_id: Number(methodId) }) });
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: 0 }));
      router.push(`/order-confirmation?order_id=${result.order_id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan belum dapat dibuat."); }
    finally { setPending(false); }
  }

  if (!snapshot) return <div className="checkout-empty"><h2>Masuk untuk checkout.</h2><p>Checkout membutuhkan akun pelanggan D-Sayur.</p><Link className="primary-button" href="/login?next=%2Fcheckout">Masuk <span>↗</span></Link></div>;
  if (!snapshot.cart.lines.length) return <div className="checkout-empty"><h2>Keranjang masih kosong.</h2><Link href="/products">Pilih produk ↗</Link></div>;
  const selectedProvider = payments?.providers.find((provider) => String(provider.id) === providerId);

  return <div className="checkout-layout"><div className="checkout-steps">
    <section className="checkout-panel"><div className="checkout-panel-title"><span>01</span><h2>Alamat pengiriman</h2></div><form className="checkout-address-form" onSubmit={saveAddress}>
      {snapshot.addresses.length > 0 && <label>Gunakan alamat tersimpan<select value={addressId} onChange={(event) => setAddressId(event.target.value)}><option value="">Masukkan alamat baru</option>{snapshot.addresses.map((address) => <option key={address.id} value={address.id}>{address.name} · {address.city}</option>)}</select></label>}
      {!addressId && <div className="form-grid"><label>Nama penerima<input name="name" required /></label><label>Nomor telepon<input name="phone" type="tel" /></label><label className="field-wide">Alamat<input name="street" required /></label><label className="field-wide">Apartemen / patokan<input name="street2" /></label><label>Kota<input name="city" required /></label><label>Kode pos<input name="zip" required /></label><input type="hidden" name="country_id" value="1" /></div>}
      <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan alamat"}</button>
    </form></section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>02</span><h2>Pengiriman</h2></div>{snapshot.delivery_methods.length ? <><label className="checkout-select">Pilih metode<select value={carrierId} onChange={(event) => setCarrierId(event.target.value)}><option value="">Pilih metode pengiriman</option>{snapshot.delivery_methods.map((method) => <option key={method.id} value={method.id}>{method.name} · {moneyLabel(method.price)}</option>)}</select></label><button className="secondary-button" disabled={!carrierId || pending} onClick={() => void saveDelivery()}>Gunakan metode ini</button></> : <p className="muted-copy">Belum ada metode pengiriman yang tersedia.</p>}</section>
    {payments && <section className="checkout-panel"><div className="checkout-panel-title"><span>03</span><h2>Pembayaran</h2></div>{selectedProvider ? <><p className="muted-copy">{selectedProvider.name} — {selectedProvider.methods[0]?.name}</p><button className="primary-button" disabled={pending || !methodId} onClick={() => void placeOrder()}>{pending ? "Membuat pesanan…" : "Buat pesanan"}<span>↗</span></button></> : <p className="muted-copy">Metode pembayaran belum tersedia.</p>}</section>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div><aside className="cart-summary checkout-summary"><h2>Ringkasan pesanan</h2>{snapshot.cart.lines.map((line)=><div key={line.id}><span>{line.product.name} × {line.quantity}</span><span>{moneyLabel(line.total)}</span></div>)}{snapshot.cart.totals && <><div><span>Subtotal</span><span>{moneyLabel(snapshot.cart.totals.subtotal)}</span></div><div><span>Pajak</span><span>{moneyLabel(snapshot.cart.totals.tax)}</span></div><div><span>Pengiriman</span><span>{moneyLabel(snapshot.cart.totals.shipping)}</span></div><div className="summary-total"><span>Total</span><strong>{moneyLabel(snapshot.cart.totals.total)}</strong></div></>}<p>Total dihitung ulang di server saat pesanan dibuat.</p></aside></div>;
}
