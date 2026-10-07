"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";
import type { AreaEstimate, ReverseGeocodeAddress, StoreBranch } from "@/types/store";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function AreaChecker() {
  const [result, setResult] = useState<AreaEstimate | null>(null);
  const [address, setAddress] = useState<ReverseGeocodeAddress | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    void storeApi<StoreBranch[]>("branches").then((items) => {
      if (items[0]) setBranchId(String(items[0].id));
    }).catch(() => setBranchId(""));
  }, []);

  async function check(latitude: number, longitude: number, selectedBranch = branchId) {
    setPending(true); setError(""); setResult(null); setAddress(null);
    try {
      const [area, foundAddress] = await Promise.all([
        storeApi<AreaEstimate>(`area-check?lat=${latitude}&lng=${longitude}&branch_id=${selectedBranch}`),
        storeApi<ReverseGeocodeAddress>(`reverse-geocode?lat=${latitude}&lng=${longitude}`),
      ]);
      setResult(area); setAddress(foundAddress);
    }
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

  return <div className="area-checker">
    <button className="primary-button area-locate" type="button" disabled={pending} onClick={locate}>{pending ? "Memeriksa…" : "Gunakan lokasi saya"} <span>◎</span></button>
    {!result && !pending && <p className="location-hint">Tekan tombol di atas untuk menemukan alamat Anda secara otomatis.</p>}
    {pending && <div className="location-loading" role="status"><span aria-hidden="true" /> Mencari alamat terdekat…</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <section className={`area-result ${result.deliverable ? "ok" : "far"}`} role="status">
      {address && <div className="detected-address"><small>Lokasi Anda</small><strong>{address.label}</strong></div>}
      {result.deliverable ? <><h2>Alamat Anda terjangkau 🎉</h2><p>Rute dari {result.branch.name}: ± {result.distance_km} km · {result.eta_min}–{result.eta_max} menit · ongkir mulai {result.fee !== null ? rupiah(result.fee) : "-"} (bisa gratis sesuai tier dan nilai belanja).</p></> : <><h2>Di luar jangkauan antar dari {result.branch.name}</h2><p>Jarak ± {result.distance_km} km melebihi 20 km. Anda tetap bisa memilih <strong>ambil sendiri di toko</strong>.</p></>}
      <Link className="primary-button" href="/products">Mulai belanja <span>↗</span></Link>
    </section>}
    <p className="muted-copy">Lokasi hanya dipakai untuk menemukan alamat dan menghitung jarak. Data tidak disimpan sebelum Anda menyimpan alamat.</p>
  </div>;
}
