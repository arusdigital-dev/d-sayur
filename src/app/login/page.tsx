import type { Metadata } from "next";
import { LoginForm } from "@/components/account/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return <main className="account-page"><div className="catalog-heading"><div className="eyebrow"><span /> AKUN D-SAYUR</div><h1>Selamat <em>datang.</em></h1><p>Masuk untuk melanjutkan belanja.</p></div><LoginForm /></main>;
}
