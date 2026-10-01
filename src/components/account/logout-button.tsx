"use client";

import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function LogoutButton() {
  const router = useRouter();
  return <button type="button" onClick={async () => { await storeApi("auth/logout", { method: "POST", body: "{}" }); router.replace("/"); router.refresh(); }}>Keluar dari akun <span>↗</span></button>;
}
