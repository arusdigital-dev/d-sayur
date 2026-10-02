"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StoreApiError, storeApi } from "@/lib/store-api";

type ManagedProduct = {
  id: number; name: string; price: number; description: string; published: boolean;
  category_ids: number[]; categories: string[]; image: string; sku: string | null; stock_quantity: number;
};
type ProductCategory = { id: number; name: string };
type ProductInput = { name: string; price: number; description: string; published: boolean; category_ids: number[]; sku: string };
const blank: ProductInput = { name: "", price: 0, description: "", published: false, category_ids: [], sku: "" };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function ProductManager() {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<ProductInput>(blank);
  const [search, setSearch] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query = "") => {
    try {
      const [items, groups] = await Promise.all([
        storeApi<ManagedProduct[]>(`admin/products${query ? `?search=${encodeURIComponent(query)}` : ""}`),
        storeApi<ProductCategory[]>("admin/categories"),
      ]);
      setProducts(items);
      setCategories(groups);
    } catch (reason) {
      if (reason instanceof StoreApiError && reason.status === 403) setError("Akun ini bukan admin toko.");
      else if (reason instanceof StoreApiError && reason.status === 401) setError("Sesi berakhir. Masuk kembali dengan akun admin toko.");
      else setError(reason instanceof Error ? reason.message : "Data belum dapat dimuat.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  function edit(product: ManagedProduct) {
    setSelected(product.id);
    setForm({ name: product.name, price: product.price, description: product.description, published: product.published, category_ids: product.category_ids, sku: product.sku ?? "" });
  }
  function newProduct() { setSelected(null); setForm(blank); setError(""); }
  function searchProducts() { setLoading(true); setError(""); void load(search); }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const category = await storeApi<ProductCategory & { slug: string }>("admin/categories", { method: "POST", body: JSON.stringify({ name }) });
      setCategories((items) => [...items, category]);
      setForm((current) => ({ ...current, category_ids: [...current.category_ids, category.id] }));
      setNewCategory("");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kategori belum dapat disimpan."); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const path = selected ? `admin/products/${selected}` : "admin/products";
      const saved = await storeApi<ManagedProduct>(path, { method: selected ? "PATCH" : "POST", body: JSON.stringify(form) });
      setProducts((items) => selected ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      edit(saved);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Produk belum dapat disimpan."); }
    finally { setSaving(false); }
  }

  return <section className="product-admin">
    <div className="admin-section-nav"><Link aria-current="page" href="/admin/products">Produk &amp; stok</Link><Link href="/admin/orders">Pesanan</Link></div>
    <div className="admin-toolbar"><label className="admin-search">Cari produk<input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchProducts(); }} placeholder="Nama produk…" /></label><button className="secondary-button" type="button" onClick={searchProducts}>Cari</button><button className="primary-button" type="button" onClick={newProduct}>＋ Produk baru</button></div>
    {error && <div className="admin-alert" role="alert">{error}{error.includes("Sesi berakhir") && <span> <Link href="/login?next=%2Fadmin%2Fproducts">Masuk lagi</Link></span>}</div>}
    <div className="admin-layout">
      <section className="admin-product-list" aria-label="Daftar produk">{loading ? <p className="muted-copy">Memuat produk…</p> : products.length ? products.map((product) => <button className={`admin-product-row${selected === product.id ? " is-selected" : ""}`} key={product.id} type="button" onClick={() => edit(product)}>{product.image && <Image src={product.image} alt="" width={54} height={54} unoptimized />}<span className="admin-product-name"><strong>{product.name}</strong><small>{product.categories.join(", ") || "Tanpa kategori"} · stok {product.stock_quantity}</small></span><span className="admin-product-price">{money(product.price)}<small>{product.published ? "Tayang" : "Draft"}</small></span></button>) : <p className="muted-copy">Belum ada produk. Tambahkan produk dari form di samping.</p>}</section>
      <form className="admin-product-form" onSubmit={save}>
        <div className="admin-form-heading"><div className="eyebrow"><span /> {selected ? `PRODUK #${selected}` : "PRODUK BARU"}</div><h2>{selected ? "Ubah produk" : "Tambah produk"}</h2></div>
        <label>Nama produk<input required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="admin-fields-row"><label>SKU<input maxLength={80} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Dikelola di Odoo" /></label><p className="muted-copy">Stok tersedia: {selected ? products.find((product) => product.id === selected)?.stock_quantity ?? 0 : "Atur di Inventory Odoo"}</p></div>
        <label>Harga (IDR)<input required type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
        <label>Deskripsi<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <fieldset><legend>Kategori</legend>{categories.length > 0 && <div className="admin-category-options">{categories.map((category) => <label key={category.id}><input type="checkbox" checked={form.category_ids.includes(category.id)} onChange={(event) => setForm({ ...form, category_ids: event.target.checked ? [...form.category_ids, category.id] : form.category_ids.filter((id) => id !== category.id) })} />{category.name}</label>)}</div>}<div className="admin-add-category"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Buat kategori baru" /><button type="button" onClick={() => void addCategory()}>Tambah</button></div></fieldset>
        <label className="admin-publish"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Tampilkan di toko</label>
        <button className="primary-button" disabled={saving || loading}>{saving ? "Menyimpan…" : "Simpan produk"}<span>↗</span></button>
        <p className="muted-copy">Katalog dan kategori disimpan di Odoo. Atur kuantitas stok melalui Inventory Odoo agar tercatat sebagai operasi persediaan.</p>
      </form>
    </div>
  </section>;
}
