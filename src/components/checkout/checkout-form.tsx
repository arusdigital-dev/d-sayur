"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { moneyLabel, storeApi } from "@/lib/store-api";
import type { CartSnapshot, CheckoutSnapshot, PaymentOptions, ReverseGeocodeAddress } from "@/types/store";
import { productPhoto } from "@/lib/product-photo";

type CompletedOrder = { completed: boolean; redirect_url: string | null; order_id: number; order_number: string };

export function CheckoutForm({ initialSnapshot }: { initialSnapshot: CheckoutSnapshot | null }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(initialSnapshot);
  const [payments, setPayments] = useState<PaymentOptions | null>(null);
  const [addressId, setAddressId] = useState(String(initialSnapshot?.default_address_id ?? ""));
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [carrierId, setCarrierId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [loyaltyCardId, setLoyaltyCardId] = useState(String(initialSnapshot?.loyalty_cards[0]?.id ?? ""));
  const [voucherId, setVoucherId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoFeedback, setPromoFeedback] = useState("");
  const [substituteChoices, setSubstituteChoices] = useState<Record<number, string>>({});
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [addressDraft, setAddressDraft] = useState({ label: "", name: "", phone: "", street: "", street2: "", city: "", zip: "" });
  const [providerId, setProviderId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [substitutionPolicy, setSubstitutionPolicy] = useState(initialSnapshot?.substitution_policy ?? "contact_first");
  const [substitutionNote, setSubstitutionNote] = useState(initialSnapshot?.substitution_note ?? "");
  const [isGift, setIsGift] = useState(initialSnapshot?.is_gift ?? false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError("Browser ini tidak mendukung deteksi lokasi."); return; }
    setPending(true); setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const latitude = Number(coords.latitude.toFixed(6));
      const longitude = Number(coords.longitude.toFixed(6));
      setPin({ latitude, longitude });
      setLocationAccuracy(Math.round(coords.accuracy));
      try {
        const address = await storeApi<ReverseGeocodeAddress>(`reverse-geocode?lat=${latitude}&lng=${longitude}`);
        const profile = await storeApi<{ logged_in: boolean; customer: { name: string; phone: string } | null }>("auth/me");
        const recipient = profile.customer?.name || addressDraft.name;
        const phone = profile.customer?.phone || addressDraft.phone;
        const draft = {
          label: "",
          name: recipient,
          phone,
          street: address.street || addressDraft.street,
          street2: address.street2 || addressDraft.street2,
          city: address.city || addressDraft.city,
          zip: address.zip || addressDraft.zip,
        };
        setAddressDraft(draft);

        if (!profile.logged_in || !draft.name.trim() || !draft.street.trim() || !draft.city.trim() || !draft.zip.trim()) {
          setError("Lokasi ditemukan. Lengkapi nama penerima, jalan, kota, atau kode pos yang belum terbaca.");
          return;
        }

        const saved = await storeApi<{ address_id: number }>("checkout/address", {
          method: "POST",
          body: JSON.stringify({ ...draft, latitude, longitude }),
        });
        const nextSnapshot = await storeApi<CheckoutSnapshot>("checkout");
        setSnapshot(nextSnapshot);
        setAddressId(String(saved.address_id));
        setAddressPickerOpen(false);
        setError("");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Titik lokasi ditemukan, tetapi alamat belum dapat disimpan. Periksa kembali detailnya."); }
      finally { setPending(false); }
    }, (reason) => {
      setPending(false);
      if (reason.code === GeolocationPositionError.PERMISSION_DENIED) setError("Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser, lalu coba lagi.");
      else if (reason.code === GeolocationPositionError.POSITION_UNAVAILABLE) setError("Lokasi perangkat belum tersedia. Aktifkan GPS atau periksa koneksi, lalu coba lagi.");
      else setError("Pencarian lokasi terlalu lama. Coba lagi di area dengan sinyal GPS yang lebih baik.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const selected = snapshot?.addresses.find((address) => address.id === Number(addressId));
    const selectedPin = selected?.latitude != null && selected.longitude != null ? { latitude: selected.latitude, longitude: selected.longitude } : null;
    try {
      const latitude = pin?.latitude ?? selectedPin?.latitude ?? (data.latitude ? Number(data.latitude) : undefined);
      const longitude = pin?.longitude ?? selectedPin?.longitude ?? (data.longitude ? Number(data.longitude) : undefined);
      const saved = await storeApi<{ address_id: number }>("checkout/address", { method: "POST", body: JSON.stringify({ ...(selected ? { ...selected, address_id: selected.id } : data), latitude, longitude }) });
      const nextSnapshot = await storeApi<CheckoutSnapshot>("checkout");
      setSnapshot(nextSnapshot);
      setAddressId(String(saved.address_id));
      setAddressPickerOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat belum dapat disimpan."); }
    finally { setPending(false); }
  }

  async function chooseAddress(nextAddressId: string) {
    if (!nextAddressId) {
      const previous = snapshot?.addresses.find((item) => item.id === Number(addressId)) ?? snapshot?.addresses.find((item) => item.id === snapshot.default_address_id);
      setAddressDraft(previous ? { label: "", name: previous.name, phone: previous.phone, street: previous.street, street2: previous.street2, city: previous.city, zip: previous.zip } : { label: "", name: "", phone: "", street: "", street2: "", city: "", zip: "" });
      setPin(previous?.latitude != null && previous.longitude != null ? { latitude: previous.latitude, longitude: previous.longitude } : null);
      setAddressId("");
      setAddressPickerOpen(false);
      return;
    }
    setAddressId(nextAddressId);
    setAddressPickerOpen(false);
    const address = snapshot?.addresses.find((item) => item.id === Number(nextAddressId));
    if (!address) return;
    setPending(true); setError("");
    try {
      await storeApi("checkout/address", { method: "POST", body: JSON.stringify({ ...address, address_id: address.id }) });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat belum dapat digunakan."); }
    finally { setPending(false); }
  }

  async function saveDelivery(nextCarrierId = carrierId, nextSlotId = slotId) {
    if (!selectedAddress) {
      setError("Simpan atau pilih alamat pengiriman sebelum memilih metode pengiriman.");
      return;
    }
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>("checkout/delivery", { method: "POST", body: JSON.stringify({ carrier_id: Number(nextCarrierId), slot_id: Number(nextSlotId) }) });
      setSnapshot((current) => current ? { ...current, cart } : current);
      const options = await storeApi<PaymentOptions>("checkout/payment");
      setPayments(options);
      const preferred = options.providers.find((provider) => provider.code === "xendit") ?? options.providers[0];
      setProviderId(String(preferred?.id ?? ""));
      const preferredMethod = preferred?.methods.find((method) => /qris/i.test(method.name)) ?? preferred?.methods[0];
      setMethodId(String(preferredMethod?.id ?? ""));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Metode pengiriman belum dapat dipilih."); }
    finally { setPending(false); }
  }

  async function updateCheckoutQuantity(lineId: number, quantity: number) {
    if (quantity < 0 || pending) return;
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>(`cart/lines/${lineId}`, quantity === 0
        ? { method: "DELETE" }
        : { method: "PATCH", body: JSON.stringify({ quantity }) });
      setSnapshot((current) => current ? { ...current, cart } : current);
      window.dispatchEvent(new CustomEvent("dsayur:cart-updated", { detail: cart.quantity }));
      if (!cart.lines.length) {
        setPayments(null);
        setProviderId("");
        setMethodId("");
      } else if (payments) {
        const options = await storeApi<PaymentOptions>("checkout/payment");
        setPayments(options);
        const provider = options.providers.find((item) => String(item.id) === providerId)
          ?? options.providers.find((item) => item.code === "xendit")
          ?? options.providers[0];
        setProviderId(String(provider?.id ?? ""));
        const method = provider?.methods.find((item) => String(item.id) === methodId)
          ?? provider?.methods.find((item) => /qris/i.test(item.name))
          ?? provider?.methods[0];
        setMethodId(String(method?.id ?? ""));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Jumlah item belum dapat diperbarui."); }
    finally { setPending(false); }
  }

  async function savePreferences(event?: React.FormEvent<HTMLFormElement>, giftValue = isGift) {
    event?.preventDefault(); setPending(true); setError("");
    try {
      const result = await storeApi<{ cart: CartSnapshot; stock_issues: CheckoutSnapshot["stock_issues"]; is_gift: boolean }>("checkout/preferences", { method: "POST", body: JSON.stringify({ substitution_policy: substitutionPolicy, substitution_note: substitutionNote, is_gift: giftValue }) });
      setSnapshot((current) => current ? { ...current, cart: result.cart, stock_issues: result.stock_issues, is_gift: result.is_gift } : current);
      setIsGift(result.is_gift);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preferensi pengganti belum tersimpan."); }
    finally { setPending(false); }
  }

  async function updateGiftPreference(enabled: boolean) {
    setPending(true); setError("");
    try {
      const result = await storeApi<{ is_gift: boolean }>("checkout/gift", { method: "POST", body: JSON.stringify({ is_gift: enabled }) });
      setIsGift(result.is_gift);
      const nextSnapshot = await storeApi<CheckoutSnapshot>("checkout");
      setSnapshot(nextSnapshot);
      setAddressId(String(nextSnapshot.default_address_id ?? ""));
      setAddressPickerOpen(false);
    } catch (reason) {
      setIsGift(!enabled);
      setError(reason instanceof Error ? reason.message : "Pilihan hadiah belum tersimpan.");
    } finally { setPending(false); }
  }

  function openRecipientAddress() {
    setAddressPickerOpen(true);
    document.querySelector(".checkout-address-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    const appliedCardId = snapshot?.redeemed_points_card_id;
    const cardId = appliedCardId ?? Number(loyaltyCardId);
    if (!cardId) return;
    setPending(true); setError("");
    try {
      await storeApi("checkout/redeem-points", {
        method: "POST",
        body: JSON.stringify({ card_id: cardId, action: appliedCardId ? "remove" : "apply" }),
      });
      setSnapshot(await storeApi<CheckoutSnapshot>("checkout"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : appliedCardId ? "Penukaran poin belum dapat dibatalkan." : "Poin belum dapat ditukar."); }
    finally { setPending(false); }
  }

  async function redeemVoucher() {
    if (!voucherId) return;
    setPending(true); setError("");
    try {
      const cart = await storeApi<CartSnapshot>("checkout/redeem-voucher", { method: "POST", body: JSON.stringify({ voucher_id: Number(voucherId) }) });
      setSnapshot((current) => current ? { ...current, cart } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Voucher belum dapat digunakan."); }
    finally { setPending(false); }
  }

  async function applyPromoCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promoCode.trim()) return;
    setPending(true); setError(""); setPromoFeedback("");
    try {
      const result = await storeApi<{ applied: boolean; message?: string; cart?: CartSnapshot }>("checkout/promo-code", { method: "POST", body: JSON.stringify({ code: promoCode.trim() }) });
      if (!result.applied || !result.cart) {
        setPromoFeedback(result.message || "Kode promo belum dapat digunakan.");
        return;
      }
      // The promo endpoint already returns the cart from the exact Odoo order it
      // updated. A second checkout request can resolve a different draft order
      // and replace a populated cart with an empty snapshot.
      if (!result.cart.lines.length && snapshot?.cart.lines.length) {
        setError("Kupon diterima, tetapi keranjang belum berhasil diperbarui. Muat ulang checkout sebelum melanjutkan.");
        return;
      }
      setPromoCode("");
      setSnapshot((current) => current ? { ...current, cart: result.cart! } : current);
      setPromoFeedback(result.message || "Kode promo berhasil diterapkan.");
    } catch (reason) { setPromoFeedback(reason instanceof Error ? reason.message : "Kode promo belum dapat digunakan."); }
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

  if (!snapshot) return <div className="checkout-empty checkout-login-empty"><section className="account-empty-card"><div className="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="21" r="11"/><path d="M11 55c1.8-11.2 9.5-17 21-17s19.2 5.8 21 17"/><path d="M45 11c5-5 11-4 12-3-1 7-5 11-12 11"/></svg></div><p className="auth-kicker">CHECKOUT D-SAYUR</p><h2>Masuk untuk melanjutkan</h2><p>Masuk untuk memilih alamat pengiriman, menyelesaikan pembayaran, dan melacak pesananmu.</p><div className="account-empty-actions"><Link className="primary-button" href="/login?next=%2Fcheckout">Masuk <span>↗</span></Link><Link className="secondary-button" href="/register">Buat akun</Link></div></section></div>;
  if (!snapshot.cart.lines.length) return <div className="checkout-empty"><h2>Keranjang masih kosong.</h2><Link href="/products">Pilih produk ↗</Link></div>;
  const selectedProvider = payments?.providers.find((provider) => String(provider.id) === providerId);
  const onlineProvider = payments?.providers.find((provider) => provider.custom_mode !== "cash_on_delivery" && provider.code === "xendit")
    ?? payments?.providers.find((provider) => provider.custom_mode !== "cash_on_delivery");
  const cashProvider = payments?.providers.find((provider) => provider.custom_mode === "cash_on_delivery");
  const visiblePaymentProviders = [onlineProvider, cashProvider].filter((provider, index, items) =>
    provider && items.findIndex((item) => item?.id === provider.id) === index,
  );
  const appliedPointsCard = snapshot.loyalty_cards.find((card) => card.id === snapshot.redeemed_points_card_id);
  const selectedDelivery = snapshot.delivery_methods.find((method) => String(method.id) === carrierId);
  const selectedAddress = snapshot.addresses.find((address) => address.id === Number(addressId));

  return <><div className="checkout-layout"><div className="checkout-steps">
    <section className="checkout-panel checkout-address-panel"><div className="checkout-panel-title"><span>01</span><h2>{isGift ? "Alamat penerima" : "Alamat pengiriman"}</h2>{selectedAddress && <button className="checkout-inline-link" type="button" onClick={() => setAddressPickerOpen((open) => !open)}>{addressPickerOpen ? "Tutup" : "Ganti"}⌄</button>}</div><form className="checkout-address-form" onSubmit={saveAddress}>
      {snapshot.addresses.length > 0 && (addressPickerOpen || !selectedAddress) && <label>{isGift ? "Pilih alamat penerima" : "Alamat pengiriman"}<select value={addressId} onChange={(event) => void chooseAddress(event.target.value)}><option value="">Tambah alamat baru</option>{snapshot.addresses.map((address) => <option key={address.id} value={address.id}>{address.id === snapshot.default_address_id ? "Alamat utama · " : ""}{address.label ? `${address.label} · ` : ""}{address.name} · {address.city}</option>)}</select></label>}
      {selectedAddress && <div className="location-result checkout-selected-address"><strong>{selectedAddress.label ? `${selectedAddress.label} · ` : ""}{selectedAddress.id === snapshot.default_address_id ? "Alamat utama · langsung digunakan" : "Alamat tujuan"}</strong><span><b>{selectedAddress.name}</b>{selectedAddress.phone ? ` · ${selectedAddress.phone}` : ""}</span><span>{[selectedAddress.street, selectedAddress.street2, selectedAddress.city, selectedAddress.zip, selectedAddress.country].filter(Boolean).join(", ")}</span>{selectedAddress.latitude != null && selectedAddress.longitude != null && <a href={`https://www.openstreetmap.org/?mlat=${selectedAddress.latitude}&mlon=${selectedAddress.longitude}#map=16/${selectedAddress.latitude}/${selectedAddress.longitude}`} target="_blank" rel="noreferrer">Lihat titik alamat ↗</a>}</div>}
      {!addressId && <><button className="secondary-button location-button" type="button" disabled={pending} onClick={useCurrentLocation}>{pending ? "Mencari alamat…" : "Gunakan lokasi saya"}</button><div className="form-grid"><input type="hidden" name="label" value={addressDraft.label} /><label>Nama penerima<input name="name" required value={addressDraft.name} onChange={(event) => setAddressDraft((old) => ({ ...old, name: event.target.value }))} /></label><label>Nomor telepon<input name="phone" type="tel" required={isGift} value={addressDraft.phone} onChange={(event) => setAddressDraft((old) => ({ ...old, phone: event.target.value }))} placeholder={isGift ? "Contoh: 0815xxxxxxxx" : undefined} /></label><label className="field-wide">Alamat 1<input name="street" required value={addressDraft.street} onChange={(event) => setAddressDraft((old) => ({ ...old, street: event.target.value }))} placeholder="Nama jalan dan nomor rumah" /></label><label className="field-wide">Alamat 2<input name="street2" value={addressDraft.street2} onChange={(event) => setAddressDraft((old) => ({ ...old, street2: event.target.value }))} placeholder="Apartemen, RT/RW, kelurahan, atau patokan" /></label><label>Kota / kabupaten<input name="city" required value={addressDraft.city} onChange={(event) => setAddressDraft((old) => ({ ...old, city: event.target.value }))} /></label><label>Kode pos<input name="zip" required value={addressDraft.zip} onChange={(event) => setAddressDraft((old) => ({ ...old, zip: event.target.value }))} /></label><input type="hidden" name="country_id" value="1" /><input name="latitude" type="hidden" value={pin?.latitude ?? ""} /><input name="longitude" type="hidden" value={pin?.longitude ?? ""} /></div></>}
      {pin && <div className="location-result" aria-live="polite"><strong>Detail lokasi terdeteksi</strong><span>{[addressDraft.street, addressDraft.street2, addressDraft.city, addressDraft.zip].filter(Boolean).join(", ") || "Alamat belum terbaca — lengkapi kolom alamat secara manual."}</span><small>Koordinat: {pin.latitude}, {pin.longitude}{locationAccuracy != null ? ` · akurasi perangkat sekitar ${locationAccuracy} m` : ""}</small><a href={`https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=18/${pin.latitude}/${pin.longitude}`} target="_blank" rel="noreferrer">Periksa titik lokasi di peta ↗</a><small>Pastikan pin dan alamat sudah sesuai sebelum menyimpan.</small></div>}
      {(!selectedAddress || addressPickerOpen) && <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : selectedAddress ? "Gunakan alamat ini" : "Simpan alamat"}</button>}
    </form></section>
    <section className="checkout-panel checkout-delivery-panel"><div className="checkout-panel-title"><span>02</span><h2>Pengiriman</h2></div>{snapshot.eta && <p className="checkout-branch-eta">Dari {snapshot.branch?.name}: {snapshot.eta.min_minutes}–{snapshot.eta.max_minutes} menit · {snapshot.eta.distance_km} km</p>}{snapshot.delivery_methods.length ? <><div className="checkout-delivery-options" role="radiogroup" aria-label="Pilih metode pengiriman">{snapshot.delivery_methods.map((method) => <button key={method.id} type="button" role="radio" aria-checked={carrierId === String(method.id)} className={`checkout-delivery-option${carrierId === String(method.id) ? " selected" : ""}`} disabled={pending || !selectedAddress} onClick={() => { setCarrierId(String(method.id)); if (!method.requires_slot) void saveDelivery(String(method.id), ""); }}><span className="checkout-radio-mark" /><span className="checkout-delivery-name">{method.name}</span><strong>{moneyLabel(method.price)}</strong></button>)}</div>{!selectedAddress && <p className="muted-copy">Pilih atau simpan alamat terlebih dahulu untuk memilih pengiriman.</p>}{selectedDelivery?.requires_slot && <label className="checkout-select">Slot pengantaran<select value={slotId} onChange={(event) => { setSlotId(event.target.value); if (event.target.value) void saveDelivery(carrierId, event.target.value); }}><option value="">Pilih waktu</option>{snapshot.delivery_slots.map((slot) => <option key={slot.id} value={slot.id} disabled={!slot.remaining}>{new Date(`${slot.start_at.replace(" ", "T")}Z`).toLocaleString("id-ID")} · {slot.priority_tier === "gold" ? "Prioritas Gold · " : ""}sisa {slot.remaining}</option>)}</select></label>}</> : <p className="muted-copy">Belum ada metode pengiriman. Periksa pin alamat dan konfigurasi rute toko.</p>}</section>
    <section className="checkout-panel checkout-gift-panel"><div className="checkout-gift-row"><span className="checkout-gift-icon" aria-hidden="true">♧</span><span>Kirim sebagai hadiah</span><label className="checkout-switch"><input type="checkbox" checked={isGift} disabled={pending} onChange={(event) => { const next = event.target.checked; setIsGift(next); void updateGiftPreference(next); }} /><span /></label></div>{isGift && <div className="checkout-gift-recipient">{selectedAddress ? <><p>Pesanan akan dikirim kepada <strong>{selectedAddress.name}</strong>{selectedAddress.phone ? <> · <a href={`tel:${selectedAddress.phone}`}>{selectedAddress.phone}</a></> : ""} di {[selectedAddress.street, selectedAddress.street2, selectedAddress.city, selectedAddress.zip].filter(Boolean).join(", ")}.</p><button type="button" className="checkout-recipient-action" onClick={openRecipientAddress}>Pilih alamat lain atau tambah alamat penerima</button></> : <><p>Tambahkan alamat tujuan dan data penerima hadiah.</p><button type="button" className="checkout-recipient-action" onClick={openRecipientAddress}>Isi alamat penerima</button></>}</div>}</section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>03</span><h2>Jika produk kosong</h2></div>{snapshot.stock_issues.length > 0 && <div className="stock-issues"><p>Stok produk berikut berubah. Pilih produk sejenis yang tersedia atau hapus item; harga dan total akan dihitung ulang oleh Odoo.</p>{snapshot.stock_issues.map((issue) => <label className="checkout-select" key={issue.line_id}>{issue.name} × {issue.quantity}<select value={substituteChoices[issue.line_id] ?? ""} onChange={(event) => setSubstituteChoices((current) => ({ ...current, [issue.line_id]: event.target.value }))}><option value="">Hapus item ini</option>{issue.alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.name} · {moneyLabel(alternative.price)}</option>)}</select></label>)}<button className="secondary-button" type="button" disabled={pending} onClick={() => void resolveStockIssues()}>{pending ? "Memperbarui…" : "Terapkan pilihan stok"}</button></div>}<form onSubmit={savePreferences} className="substitution-form"><label><input type="radio" name="substitution" value="contact_first" checked={substitutionPolicy === "contact_first"} onChange={() => setSubstitutionPolicy("contact_first")} /> Hubungi saya sebelum mengganti item mendatang</label><label><input type="radio" name="substitution" value="similar_ok" checked={substitutionPolicy === "similar_ok"} onChange={() => setSubstitutionPolicy("similar_ok")} /> Izinkan otomatis diganti dengan produk sejenis</label><label><input type="radio" name="substitution" value="no_substitute" checked={substitutionPolicy === "no_substitute"} onChange={() => setSubstitutionPolicy("no_substitute")} /> Hapus item yang stoknya kosong</label><label className="checkout-select">Catatan untuk tim toko<textarea maxLength={500} value={substitutionNote} onChange={(event) => setSubstitutionNote(event.target.value)} placeholder="Contoh: pilih sayur dengan ukuran serupa" /></label><button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan preferensi"}</button></form></section>
    <section className="checkout-panel"><div className="checkout-panel-title"><span>04</span><h2>Kode promo</h2></div><form className="checkout-address-form" onSubmit={applyPromoCode}><label>Kode promo atau voucher diskon<input value={promoCode} onChange={(event) => { setPromoCode(event.target.value); setPromoFeedback(""); }} maxLength={64} autoComplete="off" /></label><button className="secondary-button" disabled={pending || !promoCode.trim()}>{pending ? "Memeriksa…" : "Gunakan kode"}</button></form>{promoFeedback && <p className={promoFeedback.includes("berhasil") ? "promo-feedback promo-feedback-success" : "promo-feedback form-error"} role="status">{promoFeedback}</p>}<p className="muted-copy">Syarat, masa promo, tier member, dan potongan divalidasi oleh Odoo.</p></section>
    {snapshot.loyalty_cards.length > 0 && <section className="checkout-panel checkout-perks-panel"><div className="checkout-panel-title"><span>05</span><h2>Poin</h2></div><div className="checkout-perk-row"><span><svg className="checkout-points-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0797b4"/><path d="M12 5.5v13M8.5 8.5h5a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h5" stroke="white" strokeWidth="1.7" strokeLinecap="round"/></svg><span>{appliedPointsCard ? <>Poin digunakan{snapshot.redeemed_points_discount ? <small>Potongan {moneyLabel(snapshot.redeemed_points_discount)}</small> : null}</> : `${snapshot.loyalty_cards[0].points.toLocaleString("id-ID")} poin tersedia`}</span></span><button type="button" disabled={pending || (!appliedPointsCard && !loyaltyCardId)} onClick={() => void redeemPoints()}>{pending ? "Memproses…" : appliedPointsCard ? "Batalkan" : "Pakai poin"}</button></div>{!appliedPointsCard && snapshot.loyalty_cards.length > 1 && <label className="checkout-select">Kartu poin<select value={loyaltyCardId} onChange={(event) => setLoyaltyCardId(event.target.value)}><option value="">Pilih kartu poin</option>{snapshot.loyalty_cards.map((card) => <option key={card.id} value={card.id}>{card.points.toLocaleString("id-ID")} poin</option>)}</select></label>}<p className="muted-copy">Poin yang digunakan dihitung ulang oleh Odoo.</p></section>}
    {snapshot.vouchers.length > 0 && <section className="checkout-panel checkout-perks-panel"><div className="checkout-panel-title"><span>05</span><h2>Voucher yang tersedia</h2></div><div className="checkout-voucher-list">{snapshot.vouchers.map((voucher) => <button key={voucher.id} type="button" className={`checkout-voucher${voucherId === String(voucher.id) ? " selected" : ""}`} onClick={() => setVoucherId(String(voucher.id))}><span>♧</span><b>{voucher.name} · {moneyLabel({ amount: voucher.value, currency: "IDR" })}</b><small>{voucherId === String(voucher.id) ? "Dipilih" : "Pilih voucher"}</small></button>)}</div>{voucherId && <button className="secondary-button" type="button" disabled={pending} onClick={() => void redeemVoucher()}>{pending ? "Menghitung ulang…" : "Gunakan voucher"}</button>}<form className="checkout-promo-inline" onSubmit={applyPromoCode}><input aria-label="Kode promo" placeholder="Masukkan kode promo" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} maxLength={64} autoComplete="off" /><button disabled={pending || !promoCode.trim()}>{pending ? "Memeriksa…" : "Pakai"}</button></form></section>}
    {payments && <section className="checkout-panel"><div className="checkout-panel-title"><span>06</span><h2>Pembayaran</h2></div>{selectedProvider ? <>
      <div className="checkout-payment-options" role="radiogroup" aria-label="Pilih metode pembayaran">{visiblePaymentProviders.map((provider) => { if (!provider) return null; const cash = provider.custom_mode === "cash_on_delivery"; const isSelected = String(provider.id) === providerId; return <button key={provider.id} type="button" role="radio" aria-checked={isSelected} className={`checkout-payment-choice${isSelected ? " selected" : ""}`} disabled={pending} onClick={() => { setProviderId(String(provider.id)); const method = provider.methods.find((item) => String(item.id) === methodId) ?? provider.methods.find((item) => /qris/i.test(item.name)) ?? provider.methods[0]; setMethodId(String(method?.id ?? "")); }}><span className="checkout-radio-mark" /><span><strong>{cash ? "Tunai saat pesanan diterima" : "Pembayaran online"}</strong><small>{cash ? "Bayar langsung kepada kurir atau petugas toko." : "Pilih kanal pembayaran online yang tersedia."}</small></span></button>; })}</div>
      {selectedProvider.custom_mode !== "cash_on_delivery" && selectedProvider.methods.length > 1 && <label className="checkout-select">Kanal pembayaran<select value={methodId} onChange={(event) => setMethodId(event.target.value)}>{selectedProvider.methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>}
      <p className="muted-copy">{selectedProvider.custom_mode === "cash_on_delivery" ? "Pesanan dikonfirmasi sekarang dan pembayaran dicatat saat pesanan diterima." : "Pesanan diproses setelah pembayaran online berhasil."}</p></> : <p className="muted-copy">Metode pembayaran belum tersedia.</p>}</section>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div><aside className="cart-summary checkout-summary"><h2>Pesanan</h2>{snapshot.cart.lines.map((line)=><div className="checkout-summary-line" key={line.id}><Image unoptimized src={productPhoto(line.product.name, line.product.image)} alt="" width={40} height={40} /><span>{line.product.name}<small>{line.variant_name ? `${line.variant_name} · ` : ""}{moneyLabel(line.unit_price)}</small></span><div className="checkout-line-total"><strong>{moneyLabel(line.total)}</strong><div className="checkout-quantity"><button type="button" aria-label={`Kurangi ${line.product.name}`} disabled={pending} onClick={() => void updateCheckoutQuantity(line.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Tambah ${line.product.name}`} disabled={pending || line.quantity >= 100} onClick={() => void updateCheckoutQuantity(line.id, line.quantity + 1)}>+</button></div></div></div>)}{snapshot.cart.totals && <><div><span>Subtotal</span><span>{moneyLabel(snapshot.cart.totals.subtotal)}</span></div><div><span>Pajak</span><span>{moneyLabel(snapshot.cart.totals.tax)}</span></div><div><span>Ongkir</span><span>{moneyLabel(snapshot.cart.totals.shipping)}</span></div>{snapshot.redeemed_points_discount && <div className="checkout-points-summary"><span><svg className="checkout-points-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0797b4"/><path d="M12 5.5v13M8.5 8.5h5a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h5" stroke="white" strokeWidth="1.7" strokeLinecap="round"/></svg><span>Potongan poin D-Sayur</span></span><strong>−{moneyLabel(snapshot.redeemed_points_discount)}</strong></div>}<div className="summary-total"><span>Total pembayaran</span><strong>{moneyLabel(snapshot.cart.totals.total)}</strong></div></>}<p>Total akhir dikonfirmasi oleh Odoo.</p></aside></div>{payments && <div className="checkout-paybar"><div><small>Total pembayaran</small><strong>{snapshot.cart.totals ? moneyLabel(snapshot.cart.totals.total) : "—"}</strong></div><button className="primary-button" disabled={pending || !methodId || !selectedProvider} onClick={() => void placeOrder()}>{pending ? "Memproses…" : selectedProvider?.custom_mode === "cash_on_delivery" ? "Buat pesanan · bayar tunai" : "Beli dan antar sekarang"}<span>↗</span></button></div>}</>;
}
