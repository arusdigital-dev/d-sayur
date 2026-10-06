"use client";

import { useState } from "react";

export function ProductSocialActions({ name }: { name: string }) {
  const [favorite, setFavorite] = useState(false);
  const [message, setMessage] = useState("");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else { await navigator.clipboard.writeText(url); setMessage("Tautan produk disalin."); }
    } catch { setMessage("Tautan produk belum dapat dibagikan."); }
  }

  return <div className="detail-social-actions">
    <button type="button" aria-label={favorite ? "Hapus dari favorit" : "Simpan ke favorit"} aria-pressed={favorite} className={favorite ? "is-favorite" : ""} onClick={() => setFavorite((current) => !current)}><span aria-hidden="true">♥</span></button>
    <button type="button" aria-label="Bagikan produk" onClick={() => void share()}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.1"/></svg></button>
    {message && <span className="sr-only" role="status">{message}</span>}
  </div>;
}
