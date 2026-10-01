import type { Metadata } from "next";
import "./globals.css";
import "./admin-products.css";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";

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
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><SiteHeader />{children}<SiteFooter /></body>
    </html>
  );
}
