"use client";

import Link from "next/link";
import { useState } from "react";
import { storeApi } from "@/lib/store-api";
import type { AreaEstimate } from "@/types/store";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function AreaChecker() {
  const [result, setResult] = useState<AreaEstimate | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function check(latitude: number, longitude: number) {
    setPending(true); setError(""); setResult(null);
    try { setResult(await storeApi<AreaEstimate>(`area-check?lat=${latitude}&lng=${longitude}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Area belum dapat diperiksa."); }
    finally { setPending(false); }
  }

  function locate() {
    if (!navigator.geolocation) { setError("Browser ini tidak mendukung deteksi lokasi. Isi koordinat secara manual."); return; }
    setPending(true); setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void check(coords.latitude, coords.longitude),
      () => { setPending(false); setError("Izin lokasi ditolak. Izinkan lokasi (butuh HTTPS atau localhost) atau isi koordinat manual."); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function manual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const latitude = Number(data.get("lat")), longitude = Number(data.get("lng"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setError("Isi koordinat yang valid."); return; }
    void check(latitude, longitude);
  }

  return <div className="area-checker">
    <button className="primary-button area-locate" type="button" disabled={pending} onClick={locate}>{pending ? "Memeriksa…" : "Gunakan lokasi saya"} <span>◎</span></button>
    <form className="area-manual" onSubmit={manual}><label>Latitude<input name="lat" inputMode="decimal" placeholder="0.92" /></label><label>Longitude<input name="lng" inputMode="decimal" placeholder="104.51" /></label><button className="secondary-button" disabled={pending}>Periksa</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <section className={`area-result ${result.deliverable ? "ok" : "far"}`} role="status">
      {result.deliverable ? <><h2>Alamat Anda terjangkau 🎉</h2><p>Jarak lewat jalan ± {result.distance_km} km · ongkir mulai {result.fee !== null ? rupiah(result.fee) : "-"} (bisa gratis sesuai tier dan nilai belanja).</p></> : <><h2>Di luar jangkauan antar</h2><p>Jarak ± {result.distance_km} km melebihi 20 km. Anda tetap bisa memilih <strong>ambil sendiri di toko</strong>.</p></>}
      <Link className="primary-button" href="/products">Mulai belanja <span>↗</span></Link>
    </section>}
    <p className="muted-copy">Lokasi hanya dipakai untuk menghitung jarak dan tidak disimpan.</p>
  </div>;
}
