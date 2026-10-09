import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./admin-products.css";
import "./storefront.css";
import "./figma-storefront.css";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export const viewport: Viewport = { themeColor: "#0E4C3D", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "D-Sayur — Baik dari alam, baik untuk kita",
    template: "%s | D-Sayur",
  },
  description:
    "Temukan sayur, buah, dan bahan dapur pilihan dari D-Sayur.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "D-Sayur",
    title: "D-Sayur — Baik dari alam, baik untuk kita",
    description: "Temukan sayur, buah, dan bahan dapur pilihan dari D-Sayur.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" data-scroll-behavior="smooth" className="h-full antialiased">
      <head><link rel="stylesheet" href="/promo-carousel-desktop-20261008.css" /></head>
      <body className="min-h-full flex flex-col"><div className="app-shell"><SiteHeader />{children}<SiteFooter /><BottomNav /></div></body>
    </html>
  );
}
