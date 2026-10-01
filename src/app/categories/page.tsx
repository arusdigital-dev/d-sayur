import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/lib/storefront";

export const metadata: Metadata = { title: "Kategori" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  return <main className="catalog-page"><div className="catalog-heading"><div className="eyebrow"><span /> PILIH YANG BAIK</div><h1>Kategori <em>segar.</em></h1><p>Kategori diatur di database D-Sayur.</p></div><div className="category-grid">{categories.map((category) => <Link className="category-card" href={`/categories/${category.slug}`} key={category.id}>{category.image && <Image unoptimized fill sizes="(max-width: 560px) 45vw, 30vw" src={category.image} alt="" />}<span>{category.name}</span><b>↗</b></Link>)}</div>{!categories.length && <div className="catalog-empty"><h2>Kategori belum tersedia.</h2><p>Tambahkan kategori dari panel Kelola Toko.</p></div>}</main>;
}
