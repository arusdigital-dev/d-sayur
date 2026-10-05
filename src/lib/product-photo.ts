import type { StoreProduct } from "@/types/store";

const PRODUCT_IMAGE_FALLBACK = "/figma/onboarding-produce.png";

/** Odoo owns product photography; this only supplies a fallback for records without an image. */
export function productPhoto(_name: string, odooImage?: string | null): string {
  return odooImage?.trim() || PRODUCT_IMAGE_FALLBACK;
}

export function storefrontProductPhoto(product: StoreProduct): string {
  return productPhoto(product.name, product.images[0]?.url);
}
