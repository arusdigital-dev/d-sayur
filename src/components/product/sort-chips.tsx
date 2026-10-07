"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { categoryImage } from "@/lib/category-image";
import type { CatalogFilter, SortKey } from "@/lib/catalog-query";
export { parseCatalogFilter, parseSort } from "@/lib/catalog-query";
import type { StoreCategory } from "@/types/store";

export function SortChips({ basePath, sort, filter, search, categorySlug, categories = [] }: { basePath: string; sort?: SortKey; filter?: CatalogFilter; search?: string; categorySlug?: string; categories?: StoreCategory[] }) {
  const [openPanel, setOpenPanel] = useState<"filters" | "categories" | null>(null);
  const hrefFor = (next: { sort?: SortKey; filter?: CatalogFilter | null } = {}) => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (categorySlug) query.set("categorySlug", categorySlug);
    const nextSort = next.sort ?? sort;
    const nextFilter = Object.hasOwn(next, "filter") ? next.filter : filter;
    if (nextSort) query.set("sort", nextSort);
    if (nextFilter) query.set("filter", nextFilter);
    return `${basePath}${query.size ? `?${query}` : ""}`;
  };
  const categoryHref = (slug?: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("categorySlug", slug);
    if (search) query.set("search", search);
    if (sort) query.set("sort", sort);
    if (filter) query.set("filter", filter);
    return `${basePath}${query.size ? `?${query}` : ""}`;
  };
  return <div className="catalog-controls">
    <nav className="chip-row" aria-label="Filter dan urutkan produk">
    <button className="chip chip-filter-icon" type="button" aria-label="Buka filter" aria-expanded={openPanel === "filters"} onClick={() => setOpenPanel((current) => current === "filters" ? null : "filters")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="16" cy="18" r="1.7"/></svg></button>
    <Link className="chip chip-sort-popular" href={hrefFor({ sort: "popular", filter: null })} aria-current={sort === "popular" && !filter}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2v12m0 0 3-3m-3 3-3-3M11 14V2m0 0L8 5m3-3 3 3" /></svg><span>Terlaris</span></Link>
    <button className="chip chip-category-toggle" type="button" aria-expanded={openPanel === "categories"} onClick={() => setOpenPanel((current) => current === "categories" ? null : "categories")}><span>Kategori</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button>
    <Link className="chip" href={hrefFor({ filter: filter === "offers" ? null : "offers" })} aria-current={filter === "offers"}>Penawaran</Link>
    <Link className="chip" href={hrefFor({ filter: filter === "discount" ? null : "discount" })} aria-current={filter === "discount"}>Diskon</Link>
    <Link className="chip" href={hrefFor({ sort: "price_asc", filter: null })} aria-current={sort === "price_asc" && !filter}>Termurah</Link>
    <Link className="chip" href={hrefFor({ sort: "price_desc", filter: null })} aria-current={sort === "price_desc" && !filter}>Termahal</Link>
    </nav>
    {openPanel === "filters" && <section className="catalog-controls-panel" aria-label="Pilihan filter dan pengurutan"><div><strong>Urutkan produk</strong><div className="catalog-control-options"><Link href={hrefFor({ sort: "popular", filter: null })} aria-current={sort === "popular" && !filter}>Terlaris</Link><Link href={hrefFor({ sort: "price_asc", filter: null })} aria-current={sort === "price_asc" && !filter}>Termurah</Link><Link href={hrefFor({ sort: "price_desc", filter: null })} aria-current={sort === "price_desc" && !filter}>Termahal</Link></div></div><div><strong>Jenis produk</strong><div className="catalog-control-options"><Link href={hrefFor({ filter: filter === "offers" ? null : "offers" })} aria-current={filter === "offers"}>Penawaran</Link><Link href={hrefFor({ filter: filter === "discount" ? null : "discount" })} aria-current={filter === "discount"}>Diskon</Link></div></div></section>}
    {openPanel === "categories" && <section className="catalog-controls-panel catalog-category-panel" aria-label="Pilih kategori"><Link href={categoryHref()} aria-current={!categorySlug}>Semua kategori</Link>{categories.map((category) => <Link href={categoryHref(category.slug)} key={category.id} aria-current={categorySlug === category.slug}><Image unoptimized src={category.image?.includes("/api/odoo-image/") ? categoryImage(category.name) : category.image || categoryImage(category.name)} alt="" width={22} height={22} />{category.name}</Link>)}</section>}
  </div>;
}
