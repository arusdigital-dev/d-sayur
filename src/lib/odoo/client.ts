import "server-only";

const baseUrl = () => {
  const value = process.env.ODOO_URL;
  if (!value) throw new Error("ODOO_NOT_CONFIGURED");
  return value.replace(/\/$/, "");
};

export async function odooRequest(path: string, init: RequestInit = {}) {
  const key = process.env.ODOO_API_KEY;
  if (!key) throw new Error("ODOO_NOT_CONFIGURED");
  // `init.headers` may be a Headers instance (BFF, customerData), which cannot be spread into an object:
  // copy it through Headers so Content-Type and the Odoo session cookie are forwarded, then pin the server-side ones.
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-DSayur-API-Key", key);
  if (process.env.ODOO_DATABASE) headers.set("X-DSayur-Database", process.env.ODOO_DATABASE);
  return fetch(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`, { ...init, cache: "no-store", headers });
}

export async function odooData<T>(path: string, init: RequestInit = {}, cookie?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  const response = await odooRequest(path, { ...init, headers });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "object" && body.error && "message" in body.error && typeof body.error.message === "string"
      ? body.error.message
      : "Permintaan ke layanan toko belum berhasil.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (body && typeof body === "object" && "success" in body && body.success === true && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

export function odooCookieHeader(cookies: Array<{ name: string; value: string }>) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}
