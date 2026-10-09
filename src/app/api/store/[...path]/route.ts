import { NextRequest, NextResponse } from "next/server";
import { odooRequest } from "@/lib/odoo/client";
import { ODOO_SESSION_COOKIE, STOREFRONT_SESSION_COOKIE } from "@/lib/odoo/customer";

type Context = { params: Promise<{ path: string[] }> };
const error = (code: string, message: string, status: number) => NextResponse.json(
  { success: false, error: { code, message } },
  { status, headers: { "Cache-Control": "private, no-store" } },
);

async function handler(request: NextRequest, context: Context) {
  const { path } = await context.params;
  if (!path.length || path.some((part) => part === "." || part === ".." || part.includes("\\"))) return error("NOT_FOUND", "Route tidak ditemukan.", 404);
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) return error("METHOD_NOT_ALLOWED", "Metode tidak didukung.", 405);
  const isLogout = request.method === "POST" && path.join("/") === "auth/logout";
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin) {
      const requestUrl = new URL(request.url);
      const forwardedSsl = request.headers.get("x-forwarded-ssl")?.toLowerCase() === "on";
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
      const protocol = forwardedSsl ? "https:" : forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;
      const host = request.headers.get("host") ?? requestUrl.host;
      try {
        if (new URL(origin).origin !== `${protocol}//${host}`) return error("FORBIDDEN", "Origin tidak diizinkan.", 403);
      } catch {
        return error("FORBIDDEN", "Origin tidak diizinkan.", 403);
      }
    }
  }

  const target = `/dsayur/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const session = request.cookies.get(STOREFRONT_SESSION_COOKIE)?.value;
  if (session) headers.set("Cookie", `${ODOO_SESSION_COOKIE}=${session}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  let body: string | undefined;
  if (request.method !== "GET") {
    body = await request.text();
    const maxBodyLength = path.join("/") === "auth/profile" ? 1_500_000 : 32_768;
    if (body.length > maxBodyLength) return error("REQUEST_TOO_LARGE", "Request terlalu besar.", 413);
  }

  try {
    const upstream = await odooRequest(target, { method: request.method, headers, body, signal: AbortSignal.timeout(15_000) });
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
    for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (name === ODOO_SESSION_COOKIE) response.cookies.set(STOREFRONT_SESSION_COOKIE, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
    }
    if (isLogout) response.cookies.set(STOREFRONT_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (cause) {
    if (isLogout) {
      const response = NextResponse.json({ success: true, data: { logged_in: false } }, { headers: { "Cache-Control": "private, no-store" } });
      response.cookies.set(STOREFRONT_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }
    if (cause instanceof Error && cause.message === "ODOO_NOT_CONFIGURED") return error("ODOO_NOT_CONFIGURED", "Odoo belum dikonfigurasi. Isi ODOO_URL dan ODOO_API_KEY.", 503);
    console.error("D-Sayur Odoo proxy error:", cause);
    return error("ODOO_UNAVAILABLE", "Layanan toko sedang tidak tersedia. Coba kembali sebentar lagi.", 503);
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
