import Link from "next/link";
import Image from "next/image";
import type { StoreCategory } from "@/types/store";
import { categoryImage } from "@/lib/category-image";
import { SortChips, type SortKey } from "@/components/product/sort-chips";

export function CatalogToolbar({ categories, selectedCategory, search, sort, basePath = "/products", title = "Kategori", back = false }: {
  categories: StoreCategory[];
  selectedCategory?: string;
  search: string;
  sort?: SortKey;
  basePath?: string;
  title?: string;
  back?: boolean;
}) {
  return <header className="ds-catalog-header">
    {back && <Link className="ds-catalog-back" href="/home" aria-label="Kembali ke beranda">‹</Link>}
    <form className="ds-search ds-catalog-search" action="/products"><span aria-hidden="true">⌕</span><input name="search" aria-label="Cari produk" defaultValue={search} placeholder="Cari sayur, buah, atau bumbu..." />{selectedCategory && <input type="hidden" name="categorySlug" value={selectedCategory} />}<button aria-label="Cari">↵</button></form>
    <div className="ds-catalog-title"><h1>{title}</h1>{basePath === "/categories" && <Link href="/products">Lihat semua</Link>}</div>
    <nav className="ds-catalog-categories" aria-label="Kategori produk"><Link href="/categories" aria-current={!selectedCategory ? "page" : undefined}>Semua</Link>{categories.map((category) => <Link href={`${basePath.startsWith("/categories") ? "/categories" : "/products"}?categorySlug=${category.slug}${search ? `&search=${encodeURIComponent(search)}` : ""}`} key={category.id} aria-current={selectedCategory === category.slug ? "page" : undefined}><Image unoptimized src={category.image?.includes("/api/odoo-image/") ? categoryImage(category.name) : category.image || categoryImage(category.name)} alt="" width={20} height={20} />{category.name}</Link>)}</nav>
    <SortChips basePath={basePath} sort={sort} search={search} categorySlug={selectedCategory} />
  </header>;
}
