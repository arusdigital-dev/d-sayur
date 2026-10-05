"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await storeApi("auth/register", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      router.replace("/account");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Akun belum dapat dibuat.");
    } finally {
      setPending(false);
    }
  }

  return <form className="account-form auth-form" onSubmit={submit}>
    <label htmlFor="register-name">Nama lengkap</label>
    <input id="register-name" name="name" autoComplete="name" minLength={2} maxLength={120} required />
    <label htmlFor="register-email">Email</label>
    <input id="register-email" type="email" name="email" autoComplete="email" required />
    <label htmlFor="register-phone">Nomor telepon</label>
    <input id="register-phone" type="tel" name="phone" autoComplete="tel" />
    <label htmlFor="register-password">Kata sandi</label>
    <input id="register-password" type="password" name="password" autoComplete="new-password" minLength={8} required />
    <button className="primary-button" disabled={pending}>{pending ? "Membuat akun..." : "Buat akun"}<span aria-hidden="true">→</span></button>
    {error && <p role="alert">{error}</p>}
    <p className="auth-switch">Sudah punya akun? <Link href="/login">Masuk</Link></p>
  </form>;
}
