export type SortKey = "popular" | "price_asc" | "price_desc";
export type CatalogFilter = "offers" | "discount";

export const parseSort = (value?: string): SortKey | undefined =>
  value === "popular" || value === "price_asc" || value === "price_desc" ? value : undefined;

export const parseCatalogFilter = (value?: string): CatalogFilter | undefined =>
  value === "offers" || value === "discount" ? value : undefined;
