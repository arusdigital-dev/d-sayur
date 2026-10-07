"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { categoryImage } from "@/lib/category-image";
import type { ApiEnvelope, StoreCategory, StoreProduct } from "@/types/store";

type ProductListing = { items: StoreProduct[]; page: number; limit: number; total: number };

export function HomeCategoryProducts({ categories, initialListing }: { categories: StoreCategory[]; initialListing: ProductListing }) {
  const [selected, setSelected] = useState<StoreCategory | null>(null);
  const [listing, setListing] = useState(initialListing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadListing(categorySlug?: string, page = 1) {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: "12", sort: "popular", page: String(page) });
      if (categorySlug) params.set("categorySlug", categorySlug);
      const response = await fetch(`/api/store/products?${params}`, { cache: "no-store" });
      const result = await response.json() as ApiEnvelope<ProductListing> | { success: false };
      if (!response.ok || !result.success) throw new Error("Unable to load products");
      setListing(result.data);
    } catch {
      setListing({ items: [], page, limit: 12, total: 0 });
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function selectCategory(category: StoreCategory) {
    if (selected?.id === category.id) {
      setSelected(null);
      setListing(initialListing);
      setError(false);
      return;
    }

    setSelected(category);
    await loadListing(category.slug);
  }

  async function changePage(page: number) {
    if (page < 1 || page > Math.ceil(listing.total / listing.limit) || page === listing.page) return;
    await loadListing(selected?.slug, page);
  }

  return <>
    <section className="ds-section ds-categories">
      <div className="ds-section-head"><h2>Kategori</h2></div>
      <div className="ds-category-list" aria-label="Pilih kategori produk">
        {categories.slice(0, 8).map((category) => <button
          className={`ds-category${selected?.id === category.id ? " is-selected" : ""}`}
          type="button"
          aria-pressed={selected?.id === category.id}
          onClick={() => void selectCategory(category)}
          key={category.id}
        >
          <Image className="ds-category-image" unoptimized src={category.image?.includes("/api/odoo-image/") ? categoryImage(category.name) : category.image || categoryImage(category.name)} alt="" width={24} height={24} />
          <span>{category.name}</span>
        </button>)}
        {!categories.length && <button className="ds-category" type="button" disabled><Image className="ds-category-image" src="/figma/category-vegetables.png" alt="" width={24} height={24} /><span>Sayuran</span></button>}
      </div>
    </section>

    <section className="ds-section ds-products" aria-live="polite">
      <div className="ds-section-head">
        <h2>{selected ? selected.name : "Segar untuk hari ini"}</h2>
        {selected
          ? <button className="ds-home-category-reset" type="button" onClick={() => { setSelected(null); setListing(initialListing); setError(false); }}>Semua produk</button>
          : <Link href="/products">Lihat semua <span>→</span></Link>}
      </div>
      {loading ? <p className="ds-home-category-message">Memuat produk {selected?.name}…</p>
        : error ? <p className="ds-home-category-message" role="alert">Produk kategori belum dapat dimuat. Coba pilih lagi.</p>
          : listing.items.length ? <><ProductGrid products={listing.items} />{Math.ceil(listing.total / listing.limit) > 1 && <nav className="product-pagination product-pagination-buttons" aria-label="Navigasi halaman produk">{Array.from({ length: Math.ceil(listing.total / listing.limit) }, (_, index) => index + 1).map((page) => <button type="button" key={page} aria-current={page === listing.page ? "page" : undefined} disabled={loading} onClick={() => void changePage(page)}>{page}</button>)}</nav>}</>
            : <div className="catalog-empty"><h2>Belum ada produk di kategori ini</h2><p>Pilih kategori lain untuk melihat produk.</p></div>}
    </section>
  </>;
}
