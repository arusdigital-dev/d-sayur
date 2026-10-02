import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D-Sayur — Prototype",
    short_name: "D-Sayur",
    description: "Prototype belanja kebutuhan pangan lokal di Tanjungpinang.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6ef",
    theme_color: "#23543d",
    lang: "id",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
