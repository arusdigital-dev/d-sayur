"use client";

import { useRef, useState, type ReactNode, type UIEvent } from "react";

export function PromoCarousel({ children, count }: { children: ReactNode; count: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function updateActive(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const firstCard = element.querySelector<HTMLElement>(".ds-promo-card");
    if (!firstCard) return;
    const step = firstCard.offsetWidth + 12;
    setActive(Math.max(0, Math.min(count - 1, Math.round(element.scrollLeft / step))));
  }

  function select(index: number) {
    const element = scroller.current;
    const card = element?.querySelectorAll<HTMLElement>(".ds-promo-card")[index];
    if (element && card) element.scrollTo({ left: element.scrollLeft + card.getBoundingClientRect().left - element.getBoundingClientRect().left, behavior: "smooth" });
  }

  return <div className="ds-promo-wrap">
    <div ref={scroller} className="ds-promo" aria-label="Promo dan pilihan produk" onScroll={updateActive}>{children}</div>
    {count > 1 && <div className="ds-promo-dots" role="group" aria-label="Pilih promo">
      {Array.from({ length: count }, (_, index) => <button key={index} type="button" aria-label={`Tampilkan promo ${index + 1}`} aria-current={active === index ? "true" : undefined} onClick={() => select(index)} />)}
    </div>}
  </div>;
}
