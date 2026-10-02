import type { StoreProduct } from "@/types/store";

const rupiah = (money: { amount: number; currency: string }) => new Intl.NumberFormat("id-ID", { style: "currency", currency: money.currency, maximumFractionDigits: 0 }).format(money.amount);

/** Unit, price-per-kg and "actual weight may differ" hints for fresh goods sold by weight. */
export function PriceMeta({ product, withNote = false }: { product: StoreProduct; withNote?: boolean }) {
  return <>
    {(product.unit_label || product.price_per_kg) && <p className="price-meta">{product.unit_label}{product.unit_label && product.price_per_kg ? " · " : ""}{product.price_per_kg && `${rupiah(product.price_per_kg)}/kg`}</p>}
    {withNote && product.weighed && <p className="weight-note">⚖ Berat akhir bisa sedikit berbeda saat ditimbang; total mengikuti harga per satuan.</p>}
  </>;
}

export function BadgeLabel({ product }: { product: StoreProduct }) {
  return product.badge ? <span className={`badge badge-${product.badge.code}`}>{product.badge.label}</span> : null;
}
