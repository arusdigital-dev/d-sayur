"use client";

import { useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";

type Profile = { name: string; email: string; phone: string };

export function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { void storeApi<{ logged_in: boolean; customer: Profile | null }>("auth/me").then((result) => setProfile(result.customer)).catch(() => setProfile(null)); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setPending(true); setMessage("");
    try {
      const updated = await storeApi<Profile>("auth/profile", { method: "PATCH", body: JSON.stringify({ name: profile.name, phone: profile.phone }) });
      setProfile(updated); setMessage("Profil tersimpan di akun Odoo.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Profil belum dapat disimpan."); }
    finally { setPending(false); }
  }
  if (!profile) return null;
  return <form className="profile-editor" onSubmit={save}>
    <h2>Profil pelanggan</h2>
    <label>Nama<input required minLength={2} maxLength={120} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
    <label>Email akun<input type="email" value={profile.email} readOnly /></label>
    <label>Nomor telepon<input type="tel" maxLength={40} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
    <button className="secondary-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan profil"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
