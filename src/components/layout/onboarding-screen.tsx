"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingScreen() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function startShopping(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (leaving) return;
    setLeaving(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push("/home"), reduceMotion ? 0 : 420);
  }

  return <main className={`onboarding-screen${leaving ? " is-leaving" : ""}`} aria-label="Selamat datang di D-Sayur">
    <section className="onboarding-panel">
      <div className="onboarding-brand-row">
        <Link className="onboarding-brand" href="/" aria-label="D-Sayur">
          <span className="onboarding-brand-symbol"><Image className="onboarding-logo" src="/figma/brand-mark.png" alt="" width={62} height={62} priority /></span>
          <span>Dsayur</span>
        </Link>
        <div className="onboarding-progress" aria-label="Halaman 3 dari 3"><i /><i /><i /></div>
      </div>

      <h1>Yang Segar<br />Untuk Setiap Hari</h1>
      <span className="onboarding-thumb" aria-hidden="true"><Image src="/figma/onboarding-thumb.png" alt="" fill sizes="95px" priority /></span>
      <p className="onboarding-copy">Pilih kebutuhan dapur favoritmu, kami antar sampai rumah.</p>

      <div className="onboarding-produce" aria-hidden="true"><Image src="/figma/onboarding-produce.png" alt="" fill priority sizes="981px" quality={82} /></div>

      <Link className="onboarding-start" href="/home" onClick={startShopping} aria-disabled={leaving}>
        <span>{leaving ? "Menyiapkan toko…" : "Mulai Berbelanja"}</span><Image src="/figma/cart.svg" alt="" width={24} height={24} />
      </Link>
    </section>
  </main>;
}
