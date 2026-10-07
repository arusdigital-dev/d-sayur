"use client";

import { useRouter } from "next/navigation";
import { BackChevron } from "@/components/product/back-chevron";

export function BackButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  function goBack() {
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin === window.location.origin) router.back();
    else router.push("/products");
  }

  return <button className={`detail-back-button${iconOnly ? " is-icon-only" : ""}`} type="button" aria-label="Kembali" onClick={goBack}><BackChevron size={20} />{!iconOnly && "Kembali"}</button>;
}
