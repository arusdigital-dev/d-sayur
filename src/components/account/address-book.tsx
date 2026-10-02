"use client";

import { useCallback, useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";

type Address = { id: number; name: string; street: string; street2: string; city: string; zip: string; phone: string; latitude: number | null; longitude: number | null };
type Form = Omit<Address, "id">;
const blank: Form = { name: "", street: "", street2: "", city: "", zip: "", phone: "", latitude: null, longitude: null };

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => setAddresses(await storeApi<Address[]>("addresses")), []);
  useEffect(() => { void storeApi<Address[]>("addresses").then(setAddresses).catch(() => setMessage("Alamat belum dapat dimuat.")); }, []);
  function edit(address: Address) { setEditing(address.id); setForm({ ...address }); setMessage(""); }
  function useLocation() {
    if (!navigator.geolocation) { setMessage("Peramban tidak menyediakan geolokasi; isi koordinat pin manual."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => setForm((old) => ({ ...old, latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) })), () => setMessage("Izin lokasi ditolak. Aktifkan izin atau isi koordinat pin manual."), { enableHighAccuracy: true, timeout: 12000 });
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
      <div className="form-grid"><label>Nama penerima<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Telepon<input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="field-wide">Alamat<input required maxLength={250} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></label><label className="field-wide">Apartemen / patokan<input maxLength={250} value={form.street2} onChange={(e) => setForm({ ...form, street2: e.target.value })} /></label><label>Kota<input required maxLength={120} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label>Kode pos<input required maxLength={24} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></label><label>Latitude<input required type="number" step="any" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} /></label><label>Longitude<input required type="number" step="any" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} /></label></div>
      <button type="button" className="secondary-button" onClick={useLocation}>Gunakan lokasi saya</button><button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan alamat"}</button>{editing && <button type="button" className="text-link" onClick={() => { setEditing(null); setForm(blank); }}>Batal</button>}
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
