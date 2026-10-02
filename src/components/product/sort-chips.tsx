import Link from "next/link";

export type SortKey = "popular" | "price_asc" | "price_desc";
const options: Array<{ key: SortKey | ""; label: string }> = [
  { key: "", label: "Semua" },
  { key: "popular", label: "Terlaris" },
  { key: "price_asc", label: "Harga terendah" },
  { key: "price_desc", label: "Harga tertinggi" },
];

export const parseSort = (value?: string): SortKey | undefined => (value === "popular" || value === "price_asc" || value === "price_desc" ? value : undefined);

export function SortChips({ basePath, sort, search }: { basePath: string; sort?: SortKey; search?: string }) {
  return <nav className="chip-row" aria-label="Urutkan produk">{options.map((option) => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (option.key) query.set("sort", option.key);
    return <Link key={option.key || "all"} className="chip" href={`${basePath}${query.size ? `?${query}` : ""}`} aria-current={(sort ?? "") === option.key}>{option.label}</Link>;
  })}</nav>;
}
