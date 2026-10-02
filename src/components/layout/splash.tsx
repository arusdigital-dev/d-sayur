"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "dsayur:splash-seen";

/** First-visit splash: brand, delivery-area check, or skip straight to shopping. */
export function Splash() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => { try { if (!window.localStorage.getItem(KEY)) setOpen(true); } catch { /* storage blocked: skip splash */ } });
  }, []);
  function close() {
    try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }
  if (!open) return null;
  return <div className="splash" role="dialog" aria-modal="true" aria-label="Selamat datang di D-Sayur">
    <div className="splash-card">
      <span className="brand-mark splash-mark">d</span>
      <h1>d.sayur<span className="brand-dot">.</span></h1>
      <p>Belanja sayur, ikan, dan paket siap masak. Diantar ke rumah di Tanjungpinang.</p>
      <Link className="primary-button" href="/area" onClick={close}>Cek area kirim <span>↗</span></Link>
      <button className="text-link splash-skip" type="button" onClick={close}>Lewati, mulai belanja</button>
      <small>Prototype untuk demo tertutup</small>
    </div>
  </div>;
}
