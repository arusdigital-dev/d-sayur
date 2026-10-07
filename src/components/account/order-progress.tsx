const steps = [
  { key: "pending_payment", label: "Menunggu bayar" },
  { key: "paid", label: "Dibayar" },
  { key: "packing", label: "Dipacking" },
  { key: "shipped", label: "Dikirim / siap diambil" },
  { key: "completed", label: "Selesai" },
];

/** The five customer-facing stages from the research brief, mapped from Odoo's progress_status. */
export function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") return <p className="order-cancelled">Pesanan dibatalkan.</p>;
  const current = status === "delivered" || status === "ready_pickup" ? "shipped" : status;
  const index = current === "completed" ? steps.length : Math.max(0, steps.findIndex((step) => step.key === current));
  return <ol className="order-steps" aria-label="Status pesanan">{steps.map((step, position) => <li key={step.key} className={position < index ? "done" : position === index ? "current" : ""} aria-current={position === index ? "step" : undefined}><span>{position < index ? "✓" : position + 1}</span>{step.label}</li>)}</ol>;
}
