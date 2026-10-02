import type { Metadata } from "next";
import { AreaChecker } from "@/components/layout/area-checker";

export const metadata: Metadata = { title: "Cek area kirim" };

export default function AreaPage() {
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> CEK AREA KIRIM</div><h1>Sampai ke <em>rumah?</em></h1><p>Ongkir dihitung dari jarak rute jalan dari toko ke alamat Anda. Ambil sendiri di toko selalu tersedia.</p></div><AreaChecker /></main>;
}
