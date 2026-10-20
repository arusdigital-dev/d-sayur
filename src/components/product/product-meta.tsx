import type { StoreProduct } from "@/types/store";

const rupiah = (money: { amount: number; currency: string }) => new Intl.NumberFormat("id-ID", { style: "currency", currency: money.currency, maximumFractionDigits: 0 }).format(money.amount);

/** Unit, price-per-kg and "actual weight may differ" hints for fresh goods sold by weight. */
export function PriceMeta({ product, withNote = false }: { product: StoreProduct; withNote?: boolean }) {
  return <>
    {(product.unit_label || product.price_per_kg) && <p className="price-meta">{product.unit_label}{product.unit_label && product.price_per_kg ? " · " : ""}{product.price_per_kg && `${rupiah(product.price_per_kg)}/kg`}</p>}
    {withNote && product.weighed && <p className="weight-note">⚖ Berat akhir bisa sedikit berbeda saat ditimbang; total mengikuti harga per satuan.</p>}
  </>;
}

export function StockAvailability({ product }: { product: StoreProduct }) {
  const stockOnHand = product.stock_on_hand;
  const hasStockCount = typeof stockOnHand === "number";
  const quantity = hasStockCount
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(stockOnHand)
    : null;
  const inStock = hasStockCount ? stockOnHand > 0 : product.available;
  const label = hasStockCount
    ? stockOnHand > 0
      ? `Tersedia ${quantity}`
      : product.available ? "Pre-order" : "Stok habis"
    : product.available ? "Tersedia" : "Stok habis";

  return <p className={`detail-stock-status${inStock ? " is-available" : " is-empty"}`}>
    <span aria-hidden="true" />{label}
  </p>;
}

export function BadgeLabel({ product }: { product: StoreProduct }) {
  return product.badge ? <span className={`badge badge-${product.badge.code}`}>{product.badge.label}</span> : null;
}
