import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./admin-products.css";
import "./storefront.css";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Splash } from "@/components/layout/splash";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const viewport: Viewport = { themeColor: "#23543d", width: "device-width", initialScale: 1 };

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
    <html lang="id" data-scroll-behavior="smooth" className={`h-full antialiased ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col"><div className="app-shell"><SiteHeader />{children}<SiteFooter /><BottomNav /><Splash /></div></body>
    </html>
  );
}
