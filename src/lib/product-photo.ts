import type { StoreProduct } from "@/types/store";

const PRODUCT_IMAGE_FALLBACK = "/figma/onboarding-produce.png";

/** Odoo owns product photography; this only supplies a fallback for records without an image. */
export function productPhoto(_name: string, odooImage?: string | null): string {
  const image = odooImage?.trim();
  if (!image) return PRODUCT_IMAGE_FALLBACK;

  // Live API responses loaded in the browser can contain Odoo's Docker-only
  // hostname. Serve those images through the same-origin proxy instead.
  try {
    const parsed = new URL(image, "https://storefront.invalid");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "web" && parts[1] === "image" && ["product.template", "product.image", "product.public.category"].includes(parts[2] ?? "") && /^\d+$/.test(parts[3] ?? "") && /^image_(128|256|512|1024)$/.test(parts[4] ?? "")) {
      return `/api/odoo-image/${parts.slice(2).map(encodeURIComponent).join("/")}?v=real-product-photos-2026-10`;
    }
  } catch {
    // Keep a non-Odoo image URL unchanged.
  }

  // Cart and checkout snapshots come directly from Odoo, so they don't pass
  // through the catalog mapper that adds the current product-photo cache key.
  if (image.startsWith("/api/odoo-image/") && !/[?&]v=/.test(image)) {
    return `${image}?v=real-product-photos-2026-10`;
  }

  return image;
}

export function storefrontProductPhoto(product: StoreProduct): string {
  return productPhoto(product.name, product.images[0]?.url);
}
