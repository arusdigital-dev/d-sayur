import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/storefront";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [firstPage, categories] = await Promise.all([
    getProducts({ page: 1, limit: 48 }),
    getCategories(),
  ]);
  const productPages = await Promise.all(
    Array.from({ length: Math.ceil(Math.max(0, firstPage.total - firstPage.items.length) / 48) }, (_, index) =>
      getProducts({ page: index + 2, limit: 48 }),
    ),
  );
  const products = [...firstPage.items, ...productPages.flatMap((page) => page.items)];
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: new URL("/products", baseUrl).toString(), changeFrequency: "daily", priority: 0.9 },
    { url: new URL("/categories", baseUrl).toString(), changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((category) => ({ url: new URL(`/categories/${category.slug}`, baseUrl).toString(), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((product) => ({ url: new URL(`/products/${product.slug}`, baseUrl).toString(), changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
