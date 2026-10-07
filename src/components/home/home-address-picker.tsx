"use client";

import Link from "next/link";
import { useState } from "react";
import { storeApi } from "@/lib/store-api";

type Address = { id: number; name: string; label: string; street: string; street2: string; city: string; zip: string; phone: string };
type Branch = { id: number; name: string; address: string; latitude: number; longitude: number };
type DeliverySnapshot = { address: Address | null; branch: Branch | null; branches: Branch[]; eta: { min_minutes: number; max_minutes: number; distance_km: number; deliverable: boolean } | null };

function PinIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></svg>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return <svg className={`ds-address-chevron${expanded ? " is-expanded" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>;
}

export function HomeAddressPicker({ initialAddress, initialBranch, initialEta, loggedIn }: { initialAddress: Address | null; initialBranch: Branch | null; initialEta: DeliverySnapshot["eta"]; loggedIn: boolean }) {
  const [address, setAddress] = useState<Address | null>(initialAddress);
  const [branch, setBranch] = useState<Branch | null>(initialBranch);
  const [eta, setEta] = useState<DeliverySnapshot["eta"]>(initialEta);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (!loggedIn) return;
    const nextOpen = !open;
    setOpen(nextOpen);
    setError("");
    if (nextOpen && addresses === null) {
      setPending(true);
      try { setAddresses(await storeApi<Address[]>("addresses")); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat belum dapat dimuat."); }
      finally { setPending(false); }
    }
  }

  async function choose(item: Address) {
    if (item.id === address?.id) { setOpen(false); return; }
    setPending(true);
    setError("");
    try {
      await storeApi(`addresses/${item.id}/default`, { method: "POST" });
      const snapshot = await storeApi<DeliverySnapshot>("home-address");
      setAddress(snapshot.address);
      setBranch(snapshot.branch);
      setEta(snapshot.eta);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("dsayur:home-address-updated", { detail: snapshot }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alamat utama belum dapat diubah."); }
    finally { setPending(false); }
  }

  const addressLabel = address?.label || address?.street || "Pilih alamat";
  const arrival = eta ? `${eta.min_minutes}–${eta.max_minutes} menit tiba` : address ? "Estimasi rute belum tersedia" : "Tambahkan pin alamat untuk estimasi";
  const addressDetails = address?.label ? `${address.street}${address.street2 ? `, ${address.street2}` : ""} · ${arrival}` : arrival;
  const addressContent = <><span className="ds-pin"><PinIcon /></span><span className="ds-location-copy"><span className="ds-location-heading"><small>Antar ke :</small><strong>{addressLabel}</strong><ChevronIcon expanded={open} /></span><small className="ds-location-details">{addressDetails}</small></span></>;

  if (!loggedIn) return <Link className="ds-location" href="/login?next=%2Faccount">{addressContent}</Link>;

  return <div className="ds-location-picker">
    <button className="ds-location" type="button" aria-expanded={open} aria-haspopup="listbox" onClick={() => void toggle()}>{addressContent}</button>
    {open && <div className="ds-location-menu" role="listbox" aria-label="Pilih alamat pengantaran">
      <p className="ds-location-menu-title">Alamat pengantaran</p>
      {pending && !addresses ? <p className="ds-address-feedback">Memuat alamat…</p> : addresses?.length ? addresses.map((item) => <button type="button" role="option" aria-selected={item.id === address?.id} className={item.id === address?.id ? "selected" : ""} key={item.id} disabled={pending} onClick={() => void choose(item)}><span><strong>{item.label || item.name}</strong><small>{[item.name, item.street, item.street2, item.city, item.zip].filter(Boolean).join(", ")}</small></span>{item.id === address?.id ? <b>Alamat utama</b> : null}</button>) : !pending && <p className="ds-address-feedback">Belum ada alamat tersimpan.</p>}
      {error && <p className="ds-address-feedback is-error" role="alert">{error}</p>}
      <Link href="/account" className="ds-address-manage">Kelola alamat di profil →</Link>
      {branch && <p className="ds-branch-estimate">Dikirim dari {branch.name} · {eta ? `estimasi ${eta.min_minutes}–${eta.max_minutes} menit${eta.deliverable ? "" : " · di luar jangkauan"}` : "atur pin alamat untuk menghitung rute"}</p>}
    </div>}
  </div>;
}
