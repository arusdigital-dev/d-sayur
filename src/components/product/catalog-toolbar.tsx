import Link from "next/link";
import Image from "next/image";
import type { StoreCategory } from "@/types/store";
import { categoryImage } from "@/lib/category-image";
import { SortChips } from "@/components/product/sort-chips";
import type { CatalogFilter, SortKey } from "@/lib/catalog-query";
import { BackChevron } from "@/components/product/back-chevron";

export function CatalogToolbar({ categories, selectedCategory, search, sort, filter, basePath = "/products", title = "Kategori", back = false }: {
  categories: StoreCategory[];
  selectedCategory?: string;
  search: string;
  sort?: SortKey;
  filter?: CatalogFilter;
  basePath?: string;
  title?: string;
  back?: boolean;
}) {
  const categoryHref = (slug?: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("categorySlug", slug);
    if (search) query.set("search", search);
    if (sort) query.set("sort", sort);
    if (filter) query.set("filter", filter);
    return `${basePath}${query.size ? `?${query}` : ""}`;
  };
  return <header className="ds-catalog-header">
    {back && <Link className="ds-catalog-back" href="/home" aria-label="Kembali ke beranda"><BackChevron /></Link>}
    <form className="ds-search ds-catalog-search" action="/products"><span aria-hidden="true">⌕</span><input name="search" aria-label="Cari produk" defaultValue={search} placeholder="Cari sayur, buah, atau bumbu..." />{selectedCategory && <input type="hidden" name="categorySlug" value={selectedCategory} />}<button aria-label="Cari">↵</button></form>
    <div className="ds-catalog-title"><h1>{title}</h1>{basePath === "/categories" && <Link href="/products">Lihat semua</Link>}</div>
    <nav id="catalog-categories" className="ds-catalog-categories" aria-label="Kategori produk"><Link className="ds-category-all" href={categoryHref()} aria-current={!selectedCategory ? "page" : undefined}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg><span>Semua</span></Link>{categories.map((category) => <Link href={categoryHref(category.slug)} key={category.id} aria-current={selectedCategory === category.slug ? "page" : undefined}><Image unoptimized src={category.image?.includes("/api/odoo-image/") ? categoryImage(category.name) : category.image || categoryImage(category.name)} alt="" width={20} height={20} />{category.name}</Link>)}</nav>
    <SortChips basePath={basePath} sort={sort} filter={filter} search={search} categorySlug={selectedCategory} categories={categories} />
  </header>;
}
