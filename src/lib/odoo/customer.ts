import "server-only";
import { cookies } from "next/headers";
import { odooData } from "@/lib/odoo/client";

export const ODOO_SESSION_COOKIE = "session_id";
export async function customerData<T>(path: string, init: RequestInit = {}) {
  const cookie = (await cookies()).get(ODOO_SESSION_COOKIE)?.value;
  return odooData<T>(path, init, cookie ? `${ODOO_SESSION_COOKIE}=${cookie}` : undefined);
}

export async function customerCookie() {
  const value = (await cookies()).get(ODOO_SESSION_COOKIE)?.value;
  return value ? `${ODOO_SESSION_COOKIE}=${value}` : undefined;
}
