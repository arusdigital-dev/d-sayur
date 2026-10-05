import type { StoreProduct } from "@/types/store";

const PRODUCT_IMAGE_FALLBACK = "/figma/onboarding-produce.png";

/** Odoo owns product photography; this only supplies a fallback for records without an image. */
export function productPhoto(_name: string, odooImage?: string | null): string {
  const image = odooImage?.trim();
  if (!image) return PRODUCT_IMAGE_FALLBACK;

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
