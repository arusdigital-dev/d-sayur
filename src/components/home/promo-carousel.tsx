"use client";

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";

export function PromoCarousel({ children, count }: { children: ReactNode; count: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function updateActive(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".ds-promo-card"));
    if (!cards.length) return;
    const center = element.getBoundingClientRect().left + element.clientWidth / 2;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const bounds = card.getBoundingClientRect();
      const cardCenter = bounds.left + bounds.width / 2;
      const nextDistance = Math.abs(center - cardCenter);
      if (nextDistance < distance) {
        nearest = index;
        distance = nextDistance;
      }
    });
    setActive(nearest);
  }

  function select(index: number, behavior: ScrollBehavior = "smooth") {
    const element = scroller.current;
    const card = element?.querySelectorAll<HTMLElement>(".ds-promo-card")[index];
    if (element && card) {
      const scrollerCenter = element.getBoundingClientRect().left + element.clientWidth / 2;
      const cardBounds = card.getBoundingClientRect();
      const cardCenter = cardBounds.left + cardBounds.width / 2;
      element.scrollTo({ left: element.scrollLeft + cardCenter - scrollerCenter, behavior });
    }
  }

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".ds-promo-card"));
    const alignAndCenterEdges = () => {
      const firstCard = cards[0];
      if (!firstCard) return;
      const edgeSpace = Math.max(0, (element.clientWidth - firstCard.getBoundingClientRect().width) / 2);
      element.style.paddingLeft = `${edgeSpace}px`;
      element.style.paddingRight = `${edgeSpace}px`;
    };
    alignAndCenterEdges();
    const initialSlide = count >= 3 ? 1 : 0;
    setActive(initialSlide);
    select(initialSlide, "instant");
    const observer = new ResizeObserver(alignAndCenterEdges);
    observer.observe(element);
    if (cards[0]) observer.observe(cards[0]);
    return () => observer.disconnect();
  }, [count]);

  return <div className="ds-promo-wrap">
    <div
      ref={scroller}
      className="ds-promo"
      role="region"
      aria-roledescription="carousel"
      aria-label="Promo dan pilihan produk"
      onScroll={updateActive}
    >{children}</div>
    {count > 1 && <div className="ds-promo-dots" role="group" aria-label="Pilih promo">
      {Array.from({ length: count }, (_, index) => <button key={index} type="button" aria-label={`Tampilkan promo ${index + 1}`} aria-current={active === index ? "true" : undefined} onClick={() => select(index)} />)}
    </div>}
  </div>;
}
