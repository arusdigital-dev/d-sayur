import type { Metadata } from "next";
import { RegisterForm } from "@/components/account/register-form";

export const metadata: Metadata = { title: "Daftar akun" };

export default function RegisterPage() {
  return <main className="account-page"><div className="catalog-heading"><div className="eyebrow"><span /> AKUN D-SAYUR</div><h1>Mulai <em>belanja.</em></h1><p>Buat akun untuk checkout dan melihat pesanan.</p></div><RegisterForm /></main>;
}
