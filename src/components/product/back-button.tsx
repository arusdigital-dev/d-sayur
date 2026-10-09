"use client";

import { useRouter } from "next/navigation";
import { BackChevron } from "@/components/product/back-chevron";

export function BackButton({ iconOnly = false, returnTo }: { iconOnly?: boolean; returnTo?: string }) {
  const router = useRouter();
  function goBack() {
    if (returnTo) {
      try {
        const target = new URL(returnTo, window.location.origin);
        if (target.origin === window.location.origin) {
          router.push(`${target.pathname}${target.search}${target.hash}`);
          return;
        }
      } catch {
        // Fall back to browser history if the return URL is invalid.
      }
    }
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin === window.location.origin) router.back();
    else router.push("/products");
  }

  return <button className={`detail-back-button${iconOnly ? " is-icon-only" : ""}`} type="button" aria-label="Kembali" onClick={goBack}><BackChevron size={20} />{!iconOnly && "Kembali"}</button>;
}
