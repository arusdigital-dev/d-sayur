"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeApi } from "@/lib/store-api";

export function RegisterForm() {
  const router=useRouter();
  const [error,setError]=useState("");
  const [pending,setPending]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setPending(true);setError("");
    const form=new FormData(event.currentTarget);
    try {
      await storeApi("auth/register",{method:"POST",body:JSON.stringify(Object.fromEntries(form))});
      router.replace("/account");router.refresh();
    } catch(reason) { setError(reason instanceof Error?reason.message:"Akun belum dapat dibuat."); }
    finally { setPending(false); }
  }
  return <form className="account-form" onSubmit={submit}><label>Nama lengkap<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label><label>Email<input type="email" name="email" autoComplete="email" required /></label><label>Nomor telepon<input type="tel" name="phone" autoComplete="tel" /></label><label>Kata sandi<input type="password" name="password" autoComplete="new-password" minLength={8} required /></label><button className="primary-button" disabled={pending}>{pending?"Membuat akun…":"Buat akun"}<span>↗</span></button>{error&&<p role="alert">{error}</p>}<p>Sudah punya akun? <Link href="/login">Masuk</Link></p></form>;
}
