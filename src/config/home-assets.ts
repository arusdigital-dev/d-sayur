import type { StoreCategory } from "@/types/store";

export const homeAssets = {
  weekendBanner: "/figma/promo-weekend-real.png",
  specialBundle: "/images/home/banners/special-package-figma-2.jpeg",
  membershipLogo: "/images/home/branding/member-logo.png",
  membershipMascot: "/images/home/banners/membership-mascot.svg",
  membershipGlow: "/images/home/banners/membership-glow.svg",
  categories: {
    promo: "/images/home/categories/serba-promo.png",
    readyToCook: "/images/home/categories/siap-masak.png",
    spices: "/images/home/categories/aneka-bumbu.png",
    frozen: "/images/home/categories/produk-beku.png",
  },
  icons: {
    cart: "/images/home/icons/shopping-cart.svg",
    search: "/images/home/icons/magnifying-glass.svg",
    discount: "/images/home/icons/voucher-discount.svg",
    package: "/images/home/icons/package.svg",
    navigation: "/images/home/icons/navigation-arrow.svg",
    plus: "/images/home/icons/plus.svg",
  },
} as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("id-ID");
}

export function findHomeCategory(categories: StoreCategory[], keywords: string[]) {
  const terms = keywords.map(normalize);
  return categories.find((category) => {
    const name = normalize(category.name);
    return terms.some((term) => name.includes(term));
  });
}
