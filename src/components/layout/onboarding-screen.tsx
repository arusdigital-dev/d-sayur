"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const slides = [
  {
    title: <>Yang Segar<br />Untuk Setiap Hari</>,
    copy: "Pilih kebutuhan dapur favoritmu, kami antar sampai rumah.",
    image: "/figma/onboarding-produce.png",
    thumb: "/figma/onboarding-thumb.png",
    imageStyle: "produce",
  },
  {
    title: <>Belanja Segar,<br />Lebih Praktis</>,
    copy: "Sayur dan buah pilihan bisa kamu pesan dengan mudah dari rumah.",
    image: "/figma/promo-fresh.png",
    thumb: "/figma/category-vegetables.png",
    imageStyle: "photo-cover",
  },
  {
    title: <>Pilihan Lokal<br />Sampai Rumah</>,
    copy: "Dukung hasil pilihan lokal dan nikmati pengantaran yang nyaman.",
    image: "/figma/promo-local.jpg",
    thumb: "/figma/category-fruit.png",
    imageStyle: "photo-contain",
  },
];

export function OnboardingScreen() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [active, setActive] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const lastInteraction = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (Date.now() - lastInteraction.current < 7000) return;
      setActive((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a, button")) return;
    pointerStart.current = event.clientX;
    lastInteraction.current = Date.now();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < 45) return;
    lastInteraction.current = Date.now();
    setActive((current) => (current + (distance < 0 ? 1 : slides.length - 1)) % slides.length);
  }

  function startShopping(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (leaving) return;
    setLeaving(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push("/home"), reduceMotion ? 0 : 420);
  }

  return <main className={`onboarding-screen${leaving ? " is-leaving" : ""}`} aria-label="Selamat datang di D-Sayur">
    <section className={`onboarding-panel${active > 0 ? " onboarding-panel--photo" : ""}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
      <div className="onboarding-brand-row">
        <Link className="onboarding-brand" href="/" aria-label="D-Sayur">
          <span className="onboarding-brand-symbol"><Image className="onboarding-logo" src="/figma/brand-mark.png" alt="" width={62} height={62} priority /></span>
          <span>Dsayur</span>
        </Link>
        <div className="onboarding-progress" role="group" aria-label="Pilih halaman pengenalan">
          {slides.map((slide, index) => <button key={slide.image} type="button" aria-label={`Tampilkan halaman ${index + 1}`} aria-current={active === index ? "step" : undefined} onClick={() => { lastInteraction.current = Date.now(); setActive(index); }} />)}
        </div>
      </div>

      <h1 key={`title-${active}`} className="onboarding-slide-in">{slides[active].title}</h1>
      <span key={`thumb-${active}`} className={`onboarding-thumb${active > 0 ? " onboarding-thumb--slide" : ""} onboarding-slide-in`} aria-hidden="true"><Image src={slides[active].thumb} alt="" fill sizes="95px" priority /></span>
      <p key={`copy-${active}`} className="onboarding-copy onboarding-slide-in">{slides[active].copy}</p>

      <div key={`produce-${active}`} className={`onboarding-produce onboarding-produce--${slides[active].imageStyle} onboarding-slide-in`} aria-hidden="true"><Image src={slides[active].image} alt="" fill priority sizes="(max-width: 402px) 100vw, 402px" quality={82} /></div>

      <Link className="onboarding-start" href="/home" onClick={startShopping} aria-disabled={leaving}>
        <span>{leaving ? "Menyiapkan toko…" : "Mulai Berbelanja"}</span><Image src="/figma/cart.svg" alt="" width={24} height={24} />
      </Link>
    </section>
  </main>;
}
