import "server-only";
import { odooData } from "@/lib/odoo/client";
import type { StoreCategory, StoreProduct } from "@/types/store";

export type ProductListing = { items: StoreProduct[]; page: number; limit: number; total: number };
const localImage = (url: string) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "web" || parts[1] !== "image" || !["product.template", "product.image", "product.public.category"].includes(parts[2] ?? "") || !/^\d+$/.test(parts[3] ?? "") || !/^image_(128|256|512|1024)$/.test(parts[4] ?? "")) return url;
    return `/api/odoo-image/${parts.slice(2).map(encodeURIComponent).join("/")}?v=real-product-photos-2026-10`;
  } catch { return url; }
};
const mapProduct = (product: StoreProduct): StoreProduct => ({ ...product, images: product.images.map((image) => ({ ...image, url: localImage(image.url) })) });

export async function getProducts(params: { search?: string; categorySlug?: string; sort?: "popular" | "price_asc" | "price_desc"; page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const listing = await odooData<ProductListing>(`/dsayur/api/products${query.size ? `?${query}` : ""}`);
  return { ...listing, items: listing.items.map(mapProduct) };
}

export async function getProduct(slug: string) {
  return odooData<StoreProduct>(`/dsayur/api/products/${encodeURIComponent(slug)}`).then(mapProduct).catch((error: unknown) => {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  });
}

export async function getCategories() {
  const categories = await odooData<StoreCategory[]>("/dsayur/api/categories");
  return categories.map((category) => ({ ...category, image: category.image ? localImage(category.image) : undefined }));
}

export async function getCategory(slug: string) {
  return odooData<{ id: number; slug: string; name: string; children: Array<{ id: number; slug: string; name: string }>; products: StoreProduct[] }>(`/dsayur/api/categories/${encodeURIComponent(slug)}`).then((category) => ({ ...category, products: category.products.map(mapProduct) })).catch((error: unknown) => {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  });
}

export async function getReorderSuggestions(cookie?: string) {
  try {
    const result = await odooData<{ items: StoreProduct[] }>("/dsayur/api/reorder-suggestions", {}, cookie);
    return result.items.map(mapProduct);
  } catch { return []; }
}
