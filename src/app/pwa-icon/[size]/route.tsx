import { ImageResponse } from "next/og";

const allowed = new Set([192, 512]);

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: raw } = await context.params;
  const size = Number(raw);
  if (!allowed.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#23543d" }}>
      <div style={{ width: size * 0.62, height: size * 0.62, display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f6ef", color: "#23543d", fontSize: size * 0.46, fontWeight: 800, borderRadius: "50% 50% 50% 14%" }}>d</div>
    </div>,
    { width: size, height: size },
  );
}
