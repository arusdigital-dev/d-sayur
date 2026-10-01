"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { storeApi } from "@/lib/store-api";

export function LoginForm() {
  const router=useRouter();
  const [error,setError]=useState("");
  const [pending,setPending]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setPending(true);setError("");
    const form=new FormData(event.currentTarget);
    try {
      await storeApi("auth/login",{method:"POST",body:JSON.stringify({login:form.get("login"),password:form.get("password")})});
      const requested=new URLSearchParams(window.location.search).get("next");
      const target=requested?new URL(requested,window.location.origin):null;
      router.replace(target?.origin===window.location.origin?`${target.pathname}${target.search}${target.hash}`:"/account");
      router.refresh();
    } catch(reason) { setError(reason instanceof Error?reason.message:"Tidak dapat masuk saat ini."); }
    finally { setPending(false); }
  }
  return <form className="account-form" onSubmit={submit}><label>Username atau email<input type="text" name="login" autoComplete="username" required /></label><label>Kata sandi<input type="password" name="password" autoComplete="current-password" required /></label><button className="primary-button" disabled={pending}>{pending?"Memeriksa…":"Masuk ke akun"}<span>↗</span></button>{error&&<p role="alert">{error}</p>}<p>Belum memiliki akun? <Link href="/register">Daftar</Link></p></form>;
}
