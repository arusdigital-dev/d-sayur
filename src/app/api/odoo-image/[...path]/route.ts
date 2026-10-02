import { NextRequest, NextResponse } from "next/server";
import { odooRequest } from "@/lib/odoo/client";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, context: Context) {
  const { path } = await context.params;
  if (path.length !== 3 || !["product.template", "product.public.category"].includes(path[0]) || !/^\d+$/.test(path[1]) || !/^image_(128|256|512|1024)$/.test(path[2])) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Gambar tidak ditemukan." } }, { status: 404 });
  }
  try {
    const upstream = await odooRequest(`/dsayur/api/image/${path.map(encodeURIComponent).join("/")}`, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    const type = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!type.startsWith("image/")) return new NextResponse(null, { status: 502 });
    return new NextResponse(await upstream.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
