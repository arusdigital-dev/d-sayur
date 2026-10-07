import Link from "next/link";

export function ProductPagination({ page, limit, total, basePath, query = {} }: {
  page: number;
  limit: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  const visiblePages = Array.from({ length: pages }, (_, index) => index + 1);
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  return <nav className="product-pagination" aria-label="Navigasi halaman produk">
    {page > 1 && <Link href={href(page - 1)} aria-label="Halaman sebelumnya">‹</Link>}
    {visiblePages.map((number) => <Link key={number} href={href(number)} aria-current={number === page ? "page" : undefined}>{number}</Link>)}
    {page < pages && <Link href={href(page + 1)} aria-label="Halaman berikutnya">›</Link>}
  </nav>;
}
