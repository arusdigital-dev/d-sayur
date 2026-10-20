"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "@/app/home/home.module.css";

const slides = [
  {
    image: "/images/home/banners/special-package-figma-2.jpeg",
    alt: "Tas berisi pilihan sayur dan buah segar",
    firstLine: "Bingung mau masak apa hari ini",
    title: "Pilih paketmu",
    action: "Belanja Sekarang",
    href: "/products?sort=popular",
    imageStyle: styles.bundlePhotoMirrored,
  },
  {
    image: "/figma/promo-fresh.png",
    alt: "Beragam sayur segar untuk kebutuhan dapur",
    firstLine: "Penuhi kebutuhan segarmu",
    title: "Pilihan hari ini",
    action: "Lihat Produk",
    href: "/products?sort=popular",
    imageStyle: styles.bundlePhotoWide,
  },
  {
    image: "/figma/promo-weekend-real.png",
    alt: "Aneka sayur segar di pasar",
    firstLine: "Belanja segar lebih mudah",
    title: "Untuk setiap hari",
    action: "Mulai Belanja",
    href: "/products",
    imageStyle: styles.bundlePhotoWide,
  },
] as const;

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD = 42;

export function SpecialCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  function moveBy(offset: number) {
    setActiveIndex((current) => (current + offset + slides.length) % slides.length);
  }

  function handlePointerUp(clientX: number) {
    if (pointerStart.current === null) return;
    const delta = clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    suppressClick.current = true;
    moveBy(delta < 0 ? 1 : -1);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  const slide = slides[activeIndex];

  return (
    <div
      className={styles.bundleCarousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Inspirasi belanja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onPointerDown={(event) => { pointerStart.current = event.clientX; }}
      onPointerUp={(event) => handlePointerUp(event.clientX)}
      onPointerCancel={() => { pointerStart.current = null; }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); moveBy(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); moveBy(-1); }
      }}
    >
      <Link
        className={styles.bundle}
        href={slide.href}
        onClick={(event) => { if (suppressClick.current) event.preventDefault(); }}
        aria-label={`${slide.title}. ${slide.action}`}
      >
        <Image
          key={slide.image}
          className={`${styles.bundlePhoto} ${slide.imageStyle}`}
          src={slide.image}
          alt={slide.alt}
          fill
          sizes="(max-width: 560px) 78vw, 360px"
          priority={activeIndex === 0}
        />
        <span className={styles.bundleShade} aria-hidden="true" />
        <span className={styles.bundleCopy} key={`${slide.title}-copy`}>
          <span>{slide.firstLine}</span>
          <strong>{slide.title}</strong>
          <b>{slide.action}</b>
        </span>
      </Link>
      <div className={styles.bundleDots} aria-label="Pilih slide carousel">
        {slides.map((item, index) => (
          <button
            key={item.image}
            type="button"
            className={index === activeIndex ? styles.bundleDotActive : undefined}
            aria-label={`Tampilkan slide ${index + 1} dari ${slides.length}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
