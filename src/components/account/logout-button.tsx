"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await storeApi("auth/logout", { method: "POST", body: "{}" });
    } catch {
      // The BFF clears the local session cookie even if Odoo is unavailable.
    } finally {
      router.replace("/");
      router.refresh();
      setPending(false);
    }
  }

  return <button type="button" disabled={pending} onClick={logout}>{pending ? "Keluar…" : "Keluar dari akun"} <span>↗</span></button>;
}
