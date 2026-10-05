import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/components/account/register-form";

export const metadata: Metadata = { title: "Daftar akun" };

export default function RegisterPage() {
  return <main className="account-page auth-page">
    <header className="auth-header"><Link href="/home" aria-label="Kembali ke beranda"><span aria-hidden="true">←</span> Kembali</Link><Link className="auth-brand" href="/home"><Image src="/figma/brand-mark.png" alt="" width={28} height={28} /> Dsayur</Link></header>
    <div className="auth-intro"><p className="auth-kicker">MEMBER D-SAYUR</p><h1>Buat akun baru</h1><p>Daftar untuk checkout lebih mudah dan pantau pesananmu.</p></div>
    <RegisterForm />
  </main>;
}
