"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import type { ProductImage } from "@/types/store";

export function ProductGallery({ images, fallbackPhoto, fallbackAlt }: { images: ProductImage[]; fallbackPhoto: string; fallbackAlt: string }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const slides = images.length ? images : [{ url: fallbackPhoto, alt: fallbackAlt }];
  const move = (direction: number) => setActiveSlide((current) => (current + direction + slides.length) % slides.length);
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (slides.length < 2 || !event.isPrimary || event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX < 0 ? 1 : -1);
  };

  return <div className="detail-gallery">
    <div
      className="detail-image"
      role="group"
      aria-roledescription="carousel"
      aria-label={`Foto produk ${activeSlide + 1} dari ${slides.length}. Geser untuk melihat foto lainnya.`}
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
      tabIndex={slides.length > 1 ? 0 : undefined}
    >
      <Image unoptimized fill draggable={false} sizes="(max-width: 850px) 86vw, 40vw" src={slides[activeSlide]?.url ?? fallbackPhoto} alt={slides[activeSlide]?.alt ?? fallbackAlt} />
    </div>
    {slides.length > 1 && <div className="detail-gallery-thumbnails" role="group" aria-label="Pilih foto produk">
      {slides.map((slide, index) => <button key={`${slide.url}-${index}`} type="button" aria-label={`Tampilkan foto ${index + 1}`} aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)}><Image unoptimized src={slide.url} alt="" width={84} height={62} /></button>)}
    </div>}
  </div>;
}
