"use client";

import { useCallback, useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";
import type { ReverseGeocodeAddress } from "@/types/store";

type Address = { id: number; name: string; label: string; street: string; street2: string; city: string; zip: string; phone: string; latitude: number | null; longitude: number | null };
type Form = Omit<Address, "id">;
const blank: Form = { name: "", label: "", street: "", street2: "", city: "", zip: "", phone: "", latitude: null, longitude: null };

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => setAddresses(await storeApi<Address[]>("addresses")), []);
  useEffect(() => { void storeApi<Address[]>("addresses").then(setAddresses).catch(() => setMessage("Alamat belum dapat dimuat.")); }, []);
  function edit(address: Address) { setEditing(address.id); setForm({ ...address, label: "" }); setMessage(""); }
  function useLocation() {
    if (!navigator.geolocation) { setMessage("Peramban ini tidak mendukung deteksi lokasi."); return; }
    setPending(true); setMessage("Mencari alamat Anda…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const latitude = Number(coords.latitude.toFixed(6));
      const longitude = Number(coords.longitude.toFixed(6));
      try {
        const address = await storeApi<ReverseGeocodeAddress>(`reverse-geocode?lat=${latitude}&lng=${longitude}`);
        setForm((old) => ({ ...old, street: address.street || old.street, street2: address.street2 || old.street2, city: address.city || old.city, zip: address.zip || old.zip, latitude, longitude }));
        setMessage("Alamat ditemukan. Periksa kembali detailnya sebelum disimpan.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Alamat belum dapat ditemukan."); }
      finally { setPending(false); }
    }, () => { setPending(false); setMessage("Izin lokasi ditolak. Aktifkan izin lokasi pada browser."); }, { enableHighAccuracy: true, timeout: 12000 });
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const item = await storeApi<Address>(editing ? `addresses/${editing}` : "addresses", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      setForm(blank); setEditing(null); await load();
      setMessage(editing ? "Alamat diperbarui." : `Alamat ${item.name} tersimpan.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Alamat belum dapat disimpan."); }
    finally { setPending(false); }
  }
  async function remove(id: number) {
    setPending(true); setMessage("");
    try { await storeApi(`addresses/${id}`, { method: "DELETE" }); await load(); if (editing === id) { setEditing(null); setForm(blank); } setMessage("Alamat dihapus dari daftar tersimpan."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Alamat belum dapat dihapus."); }
    finally { setPending(false); }
  }

  return <section className="address-book">
    <h2>Alamat tersimpan</h2>
    {addresses.length > 0 ? <div className="address-list">{addresses.map((address) => <article key={address.id}><div><strong>{address.name}</strong><p>{address.street}{address.street2 ? `, ${address.street2}` : ""}, {address.city} {address.zip}</p>{address.latitude != null && address.longitude != null && <a href={`https://www.openstreetmap.org/?mlat=${address.latitude}&mlon=${address.longitude}#map=16/${address.latitude}/${address.longitude}`} target="_blank" rel="noreferrer">Lihat pin peta</a>}</div><span><button type="button" onClick={() => edit(address)}>Ubah</button><button type="button" disabled={pending} onClick={() => void remove(address.id)}>Hapus</button></span></article>)}</div> : <p className="muted-copy">Belum ada alamat tersimpan.</p>}
    <form className="address-editor" onSubmit={save}>
      <h3>{editing ? "Ubah alamat" : "Tambah alamat"}</h3>
      <button type="button" className="secondary-button location-button" disabled={pending} onClick={useLocation}>{pending ? "Mencari alamat…" : "Gunakan lokasi saya"}</button>
      <div className="form-grid"><label>Nama penerima<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Telepon<input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="field-wide">Alamat 1<input required maxLength={250} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Nama jalan dan nomor rumah" /></label><label className="field-wide">Alamat 2<input maxLength={250} value={form.street2} onChange={(e) => setForm({ ...form, street2: e.target.value })} placeholder="Apartemen, RT/RW, kelurahan, atau patokan" /></label><label>Kota / kabupaten<input required maxLength={120} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label>Kode pos<input required maxLength={24} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></label></div>
      <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan alamat"}</button>{editing && <button type="button" className="text-link" onClick={() => { setEditing(null); setForm(blank); }}>Batal</button>}
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
