import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/account/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return <main className="account-page auth-page">
    <header className="auth-header"><Link href="/home" aria-label="Kembali ke beranda"><span aria-hidden="true">←</span> Kembali</Link><Link className="auth-brand" href="/home"><Image src="/figma/brand-mark.png" alt="" width={28} height={28} /> Dsayur</Link></header>
    <div className="auth-intro"><p className="auth-kicker">AKUN D-SAYUR</p><h1>Selamat datang</h1><p>Masuk dengan email dan kata sandi D-Sayur. Akun ini terpisah dari login panel Odoo.</p></div>
    <LoginForm />
  </main>;
}
