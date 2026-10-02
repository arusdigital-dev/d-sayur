"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server page every few seconds (max ~2 minutes) while a payment webhook is still pending. */
export function AutoRefresh({ intervalMs = 5000, maxTries = 24 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => { tries += 1; if (tries > maxTries) window.clearInterval(timer); else router.refresh(); }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, maxTries]);
  return null;
}
