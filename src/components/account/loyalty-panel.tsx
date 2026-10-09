"use client";

import { useEffect, useState } from "react";
import { storeApi } from "@/lib/store-api";
import type { LoyaltySnapshot } from "@/lib/account-data";

const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const tierLabel = { bronze: "Bronze", silver: "Silver", gold: "Gold" } as const;

export function LoyaltyPanel({ compact = false }: { compact?: boolean }) {
  const [member, setMember] = useState<LoyaltySnapshot | null>(null);
  useEffect(() => { void storeApi<LoyaltySnapshot>("member").then(setMember).catch(() => setMember(null)); }, []);
  if (!member) return null;
  const points = member.cards.reduce((sum, card) => sum + card.points, 0);
  const value = member.cards.reduce((sum, card) => sum + card.point_value, 0);
  const goal = member.next_tier_spend;
  const progress = goal ? Math.min(100, Math.round((member.month_spend / goal) * 100)) : 100;
  const nextTier = member.tier === "bronze" ? "Silver" : member.tier === "silver" ? "Gold" : null;
  return <section className={`loyalty-summary ds-loyalty${compact ? " compact" : ""}`} aria-label="Keanggotaan dan poin D-Sayur">
    <div className={`member-card ${member.tier}`}>
      <small>MEMBER D-SAYUR</small><h2>Member {tierLabel[member.tier]}</h2>
      <p>{member.points_multiplier}× poin · Gratis antar min. belanja {rupiah(member.free_shipping_minimum)}</p>
      {member.gold_discount_percent > 0 && <p>Harga member: diskon {member.gold_discount_percent}% semua produk</p>}
      {member.tier_valid_until && <p>Berlaku sampai {new Date(member.tier_valid_until).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}
      <div className="member-progress"><div className="bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progres belanja bulan ini"><i style={{ width: `${progress}%` }} /></div><p>{nextTier ? <>Belanja {rupiah(member.spend_to_next_tier)} lagi bulan ini untuk naik ke {nextTier}. (Terkumpul {rupiah(member.month_spend)}, tanpa ongkir)</> : <>Tier tertinggi tercapai · belanja bulan ini {rupiah(member.month_spend)}</>}</p></div>
      <strong className="ds-loyalty-points">{points.toLocaleString("id-ID")} <small>poin</small></strong>
    </div>
    <div className="points-card"><small>SALDO POIN</small><strong>{points.toLocaleString("id-ID")} poin</strong><p className="muted-copy">1 poin = Rp10 saat ditukar · nilai tukar saat ini {rupiah(value)}. Tukar di langkah checkout.</p></div>
    <details className="loyalty-details" open={!compact}><summary>{compact ? "Lihat benefit dan poin" : "Rincian member, tingkatan, dan poin"}<span>›</span></summary>
      <table className="tier-table"><thead><tr><th>Tier</th><th>Syarat/bulan</th><th>Poin</th><th>Gratis ongkir</th></tr></thead><tbody>{member.tiers.map((tier) => <tr key={tier.tier} className={tier.tier === member.tier ? "me" : undefined}><td>{tierLabel[tier.tier]}{tier.tier === member.tier && " ✓"}</td><td>{tier.min_spend ? `≥ ${rupiah(tier.min_spend)}` : "Semua"}</td><td>{tier.points_multiplier}×</td><td>≥ {rupiah(tier.free_shipping_minimum)}</td></tr>)}</tbody></table>
      <p className="muted-copy">{member.tiers.map((tier) => `${tierLabel[tier.tier]}: ${tier.perks}`).join(" · ")}. Tier turun maksimal satu tingkat per bulan, dievaluasi tiap tanggal 1.</p>
      {member.history.length > 0 && <><h3>Riwayat poin</h3><ul className="points-history">{member.history.map((entry, index) => <li key={`${entry.date}-${index}`}><span>{entry.description}<br /><small>{new Date(entry.date).toLocaleDateString("id-ID")}</small></span><b className={entry.points >= 0 ? "plus" : "minus"}>{entry.points >= 0 ? "+" : ""}{entry.points}</b></li>)}</ul></>}
      {member.early_access_promos.length > 0 && <div className="loyalty-promos"><small>PROMO AKSES MEMBER</small>{member.early_access_promos.map((promo) => <p key={`${promo.name}-${promo.starts_at ?? "always"}`}><strong>{promo.name}</strong> · {promo.minimum_tier.toUpperCase()}{promo.starts_at && ` · mulai ${promo.starts_at}`}{promo.ends_at && ` · sampai ${promo.ends_at}`}{promo.codes.length > 0 && <> · kode {promo.codes.join(", ")}</>}</p>)}</div>}
    </details>
  </section>;
}
