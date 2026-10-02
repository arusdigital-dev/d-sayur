"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { moneyLabel, storeApi } from "@/lib/store-api";
import type { CartSnapshot, CheckoutSnapshot, PaymentOptions } from "@/types/store";

type CompletedOrder = { completed: boolean; redirect_url: string | null; order_id: number; order_number: string };

export function CheckoutForm({ initialSnapshot }: { initialSnapshot: CheckoutSnapshot | null }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(initialSnapshot);
  const [payments, setPayments] = useState<PaymentOptions | null>(null);
  const [addressId, setAddressId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [loyaltyCardId, setLoyaltyCardId] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [substituteChoices, setSubstituteChoices] = useState<Record<number, string>>({});
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [providerId, setProviderId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [substitutionPolicy, setSubstitutionPolicy] = useState(initialSnapshot?.substitution_policy ?? "contact_first");
  const [substitutionNote, setSubstitutionNote] = useState(initialSnapshot?.substitution_note ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const selected = snapshot?.addresses.find((address) => address.id === Number(addressId));
    const selectedPin = selected?.latitude != null && selected.longitude != null ? { latitude: selected.latitude, longitude: selected.longitude } : null;
    try {
      const latitude = pin?.latitude ?? selectedPin?.latitude ?? Number(data.latitude);
      const longitude = pin?.longitude ?? selectedPin?.longitude ?? Number(data.longitude);
      await storeApi("checkout/address", { method: "POST", body: JSON.stringify({ ...(selected ? { ...selected, address_id: selected.id } : data), latitude, longitude }) });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat belum dapat disimpan."); }
    finally { setPending(false); }
  }

  async function saveDelivery() {
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>("checkout/delivery", { method: "POST", body: JSON.stringify({ carrier_id: Number(carrierId), slot_id: Number(slotId) }) });
      setSnapshot((current) => current ? { ...current, cart } : current);
      const options = await storeApi<PaymentOptions>("checkout/payment");
      setPayments(options);
      const preferred = options.providers.find((provider) => provider.code === "xendit") ?? options.providers[0];
      setProviderId(String(preferred?.id ?? ""));
      setMethodId(String(preferred?.methods[0]?.id ?? ""));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Metode pengiriman belum dapat dipilih."); }
    finally { setPending(false); }
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await storeApi<{ cart: CartSnapshot; stock_issues: CheckoutSnapshot["stock_issues"] }>("checkout/preferences", { method: "POST", body: JSON.stringify({ substitution_policy: substitutionPolicy, substitution_note: substitutionNote }) });
      setSnapshot((current) => current ? { ...current, cart: result.cart, stock_issues: result.stock_issues } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preferensi pengganti belum tersimpan."); }
    finally { setPending(false); }
  }

  async function resolveStockIssues() {
    if (!snapshot?.stock_issues.length) return;
    setPending(true); setError("");
    try {
      const result = await storeApi<{ cart: CartSnapshot; stock_issues: CheckoutSnapshot["stock_issues"] }>("checkout/substitutions", {
        method: "POST",
        body: JSON.stringify({ actions: snapshot.stock_issues.map((issue) => ({ line_id: issue.line_id, product_id: substituteChoices[issue.line_id] ? Number(substituteChoices[issue.line_id]) : null })) }),
      });
      setSnapshot((current) => current ? { ...current, cart: result.cart, stock_issues: result.stock_issues } : current);
      setSubstituteChoices({});
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Item yang stoknya kurang belum dapat ditangani."); }
    finally { setPending(false); }
  }

  async function redeemPoints() {
    if (!loyaltyCardId) return;
    setPending(true); setError("");
    try {
      await storeApi("checkout/redeem-points", { method: "POST", body: JSON.stringify({ card_id: Number(loyaltyCardId) }) });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Poin belum dapat ditukar."); }
    finally { setPending(false); }
  }

  async function redeemVoucher() {
    if (!voucherId) return;
    setPending(true); setError("");
    try {
      await storeApi("checkout/redeem-voucher", { method: "POST", body: JSON.stringify({ voucher_id: Number(voucherId) }) });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Voucher belum dapat digunakan."); }
    finally { setPending(false); }
  }

  async function applyPromoCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promoCode.trim()) return;
    setPending(true); setError("");
    try {
      await storeApi("checkout/promo-code", { method: "POST", body: JSON.stringify({ code: promoCode.trim() }) });
      setPromoCode("");
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kode promo belum dapat digunakan."); }
    finally { setPending(false); }
  }

  async function placeOrder() {
    setPending(true); setError("");
    try {
      const result = await storeApi<CompletedOrder>("checkout/transaction", { method: "POST", body: JSON.stringify({ provider_id: Number(providerId), payment_method_id: Number(methodId) }) });
      if (result.redirect_url) { window.location.assign(result.redirect_url); return; }
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: 0 }));
      router.push(`/order-confirmation?order_id=${result.order_id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan belum dapat dibuat."); }
    finally { setPending(false); }
  }

  if (!snapshot) return <div className="checkout-empty"><h2>Masuk untuk checkout.</h2><p>Checkout membutuhkan akun pelanggan D-Sayur.</p><Link className="primary-button" href="/login?next=%2Fcheckout">Masuk <span>↗</span></Link></div>;
  if (!snapshot.cart.lines.length) return <div className="checkout-empty"><h2>Keranjang masih kosong.</h2><Link href="/products">Pilih produk ↗</Link></div>;
  const selectedProvider = payments?.providers.find((provider) => String(provider.id) === providerId);
  const selectedDelivery = snapshot.delivery_methods.find((method) => String(method.id) === carrierId);

  return <div className="checkout-layout"><div className="checkout-steps">
    <section className="checkout-panel"><div className="checkout-panel-title"><span>01</span><h2>Alamat pengiriman</h2></div><form className="checkout-address-form" onSubmit={saveAddress}>
      {snapshot.addresses.length > 0 && <label>Gunakan alamat tersimpan<select value={addressId} onChange={(event) => setAddressId(event.target.value)}><option value="">Masukkan alamat baru</option>{snapshot.addresses.map((address) => <option key={address.id} value={address.id}>{address.name} · {address.city}</option>)}</select></label>}
      {!addressId && <div className="form-grid"><label>Nama penerima<input name="name" required /></label><label>Nomor telepon<input name="phone" type="tel" /></label><label className="field-wide">Alamat<input name="street" required /></label><label className="field-wide">Apartemen / patokan<input name="street2" /></label><label>Kota<input name="city" required /></label><label>Kode pos<input name="zip" required /></label><input type="hidden" name="country_id" value="1" /><label>Latitude pin<input name="latitude" type="number" step="any" value={pin?.latitude ?? ""} onChange={(event) => setPin((old) => ({ latitude: Number(event.target.value), longitude: old?.longitude ?? 0 }))} required /></label><label>Longitude pin<input name="longitude" type="number" step="any" value={pin?.longitude ?? ""} onChange={(event) => setPin((old) => ({ latitude: old?.latitude ?? 0, longitude: Number(event.target.value) }))} required /></label></div>}
      <button className="secondary-button" type="button" disabled={pending} onClick={() => { if (!navigator.geolocation) { setError("Isi koordinat pin secara manual; browser ini tidak mendukung lokasi."); return; } navigator.geolocation.getCurrentPosition(({ coords }) => { setPin({ latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) }); setError(""); }, () => setError("Izin lokasi ditolak. Aktifkan izin lokasi atau isi koordinat manual."), { enableHighAccuracy: true, timeout: 12000 }); }}>Gunakan lokasi saya</button>
      {pin && <p className="muted-copy">Pin alamat: {pin.latitude}, {pin.longitude} · <a href={`https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=16/${pin.latitude}/${pin.longitude}`} target="_blank" rel="noreferrer">Lihat peta</a></p>}
      <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan alamat"}</button>
    </form></section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>02</span><h2>Pengiriman</h2></div>{snapshot.delivery_methods.length ? <><label className="checkout-select">Pilih metode<select value={carrierId} onChange={(event) => setCarrierId(event.target.value)}><option value="">Pilih metode pengiriman</option>{snapshot.delivery_methods.map((method) => <option key={method.id} value={method.id}>{method.name} · {moneyLabel(method.price)}</option>)}</select></label>{selectedDelivery?.requires_slot && <label className="checkout-select">Slot pengantaran<select value={slotId} onChange={(event) => setSlotId(event.target.value)}><option value="">Pilih waktu</option>{snapshot.delivery_slots.map((slot) => <option key={slot.id} value={slot.id} disabled={!slot.remaining}>{new Date(`${slot.start_at.replace(" ", "T")}Z`).toLocaleString("id-ID")} · {slot.priority_tier === "gold" ? "Prioritas Gold · " : ""}sisa {slot.remaining}</option>)}</select></label>}<button className="secondary-button" disabled={!carrierId || pending || Boolean(selectedDelivery?.requires_slot && !slotId)} onClick={() => void saveDelivery()}>Gunakan metode ini</button></> : <p className="muted-copy">Belum ada metode pengiriman. Periksa pin alamat dan konfigurasi rute toko.</p>}</section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>03</span><h2>Jika produk kosong</h2></div>{snapshot.stock_issues.length > 0 && <div className="stock-issues"><p>Stok produk berikut berubah. Pilih produk sejenis yang tersedia atau hapus item; harga dan total akan dihitung ulang oleh Odoo.</p>{snapshot.stock_issues.map((issue) => <label className="checkout-select" key={issue.line_id}>{issue.name} × {issue.quantity}<select value={substituteChoices[issue.line_id] ?? ""} onChange={(event) => setSubstituteChoices((current) => ({ ...current, [issue.line_id]: event.target.value }))}><option value="">Hapus item ini</option>{issue.alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.name} · {moneyLabel(alternative.price)}</option>)}</select></label>)}<button className="secondary-button" type="button" disabled={pending} onClick={() => void resolveStockIssues()}>{pending ? "Memperbarui…" : "Terapkan pilihan stok"}</button></div>}<form onSubmit={savePreferences} className="substitution-form"><label><input type="radio" name="substitution" value="contact_first" checked={substitutionPolicy === "contact_first"} onChange={() => setSubstitutionPolicy("contact_first")} /> Hubungi saya sebelum mengganti item mendatang</label><label><input type="radio" name="substitution" value="similar_ok" checked={substitutionPolicy === "similar_ok"} onChange={() => setSubstitutionPolicy("similar_ok")} /> Izinkan otomatis diganti dengan produk sejenis</label><label><input type="radio" name="substitution" value="no_substitute" checked={substitutionPolicy === "no_substitute"} onChange={() => setSubstitutionPolicy("no_substitute")} /> Hapus item yang stoknya kosong</label><label className="checkout-select">Catatan untuk tim toko<textarea maxLength={500} value={substitutionNote} onChange={(event) => setSubstitutionNote(event.target.value)} placeholder="Contoh: pilih sayur dengan ukuran serupa" /></label><button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan preferensi"}</button></form></section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>04</span><h2>Kode promo</h2></div><form className="checkout-address-form" onSubmit={applyPromoCode}><label>Kode dari D-Sayur atau voucher<input value={promoCode} onChange={(event) => setPromoCode(event.target.value)} maxLength={64} autoComplete="off" /></label><button className="secondary-button" disabled={pending || !promoCode.trim()}>{pending ? "Memeriksa…" : "Gunakan kode"}</button></form><p className="muted-copy">Syarat, masa promo, tier member, dan potongan divalidasi oleh Odoo.</p></section>
    {snapshot.loyalty_cards.length > 0 && <section className="checkout-panel"><div className="checkout-panel-title"><span>05</span><h2>Tukar poin member</h2></div><label className="checkout-select">Kartu poin<select value={loyaltyCardId} onChange={(event) => setLoyaltyCardId(event.target.value)}><option value="">Pilih kartu</option>{snapshot.loyalty_cards.map((card) => <option key={card.id} value={card.id}>{card.points} poin · potongan sampai {moneyLabel({ amount: card.points * 10, currency: "IDR" })}</option>)}</select></label><button className="secondary-button" type="button" disabled={!loyaltyCardId || pending} onClick={() => void redeemPoints()}>{pending ? "Menghitung ulang…" : "Terapkan poin"}</button><p className="muted-copy">Odoo menerapkan diskon dan mengurangi poin sesuai nilai order yang memenuhi syarat.</p></section>}
    {snapshot.vouchers.length > 0 && <section className="checkout-panel"><div className="checkout-panel-title"><span>05</span><h2>Voucher member</h2></div><label className="checkout-select">Pilih voucher<select value={voucherId} onChange={(event) => setVoucherId(event.target.value)}><option value="">Pilih voucher</option>{snapshot.vouchers.map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.name} · {moneyLabel({ amount: voucher.value, currency: "IDR" })}</option>)}</select></label><button className="secondary-button" type="button" disabled={!voucherId || pending} onClick={() => void redeemVoucher()}>{pending ? "Menghitung ulang…" : "Gunakan voucher"}</button></section>}
    {payments && <section className="checkout-panel"><div className="checkout-panel-title"><span>06</span><h2>Pembayaran</h2></div>{payments.providers.length ? <>
      <div className="payment-providers" role="radiogroup" aria-label="Metode pembayaran">{payments.providers.map((provider) => <label key={provider.id} className={`payment-option${String(provider.id) === providerId ? " selected" : ""}`}><input type="radio" name="provider" value={provider.id} checked={String(provider.id) === providerId} onChange={() => { setProviderId(String(provider.id)); setMethodId(String(provider.methods[0]?.id ?? "")); }} /><span><strong>{provider.code === "xendit" ? "Xendit" : provider.name}</strong><small>{provider.code === "xendit" ? "QRIS, virtual account bank, e-wallet" : "Cadangan untuk demo; dikonfirmasi admin"}</small></span></label>)}</div>
      {selectedProvider && selectedProvider.methods.length > 1 && <label className="checkout-select">Pilih kanal pembayaran<select value={methodId} onChange={(event) => setMethodId(event.target.value)}>{selectedProvider.methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>}
      {selectedProvider?.flow === "redirect" && <p className="muted-copy">Anda akan diarahkan ke halaman pembayaran Xendit, lalu kembali ke toko setelah membayar.</p>}
      <button className="primary-button" disabled={pending || !methodId} onClick={() => void placeOrder()}>{pending ? "Membuat pesanan…" : selectedProvider?.flow === "redirect" ? "Bayar dengan Xendit" : "Buat pesanan"}<span>↗</span></button></> : <p className="muted-copy">Metode pembayaran belum tersedia.</p>}</section>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div><aside className="cart-summary checkout-summary"><h2>Ringkasan pesanan</h2>{snapshot.cart.lines.map((line)=><div key={line.id}><span>{line.product.name} × {line.quantity}</span><span>{moneyLabel(line.total)}</span></div>)}{snapshot.cart.totals && <><div><span>Subtotal</span><span>{moneyLabel(snapshot.cart.totals.subtotal)}</span></div><div><span>Pajak</span><span>{moneyLabel(snapshot.cart.totals.tax)}</span></div><div><span>Pengiriman</span><span>{moneyLabel(snapshot.cart.totals.shipping)}</span></div><div className="summary-total"><span>Total</span><strong>{moneyLabel(snapshot.cart.totals.total)}</strong></div></>}<p>Total dihitung ulang di server saat pesanan dibuat.</p></aside></div>;
}
