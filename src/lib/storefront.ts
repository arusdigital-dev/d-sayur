import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { CartSnapshot, StoreCategory, StoreProduct } from "@/types/store";

type ProductRow = { id: number; name: string; slug: string; description: string; base_price: string; image_url: string; tax_rate: string; published: boolean; active: boolean };
type VariantRow = { id: number; product_id: number; sku: string | null; name: string; attributes: Record<string, string>; price_override: string | null; stock_quantity: number; active: boolean };
type CategoryRow = { id: number; name: string; slug: string; image_url: string };

const currency = { currency: "IDR", symbol: "Rp", position: "before" as const };
export const money = (amount: number) => ({ amount, ...currency });
const numeric = (value: string | number | null | undefined) => Number(value ?? 0);

async function productCard(row: ProductRow): Promise<StoreProduct> {
  const [categories, variants] = await Promise.all([
    db.query<{ id: number; name: string; slug: string }>(
      `SELECT c.id, c.name, c.slug FROM categories c JOIN product_category_links l ON l.category_id=c.id
       WHERE l.product_id=$1 AND c.active ORDER BY c.sequence, c.name`, [row.id]),
    db.query<VariantRow>("SELECT * FROM product_variants WHERE product_id=$1 AND active ORDER BY id", [row.id]),
  ]);
  const variantRows = variants.rows;
  const firstPrice = variantRows.find((variant) => variant.active)?.price_override;
  const category = categories.rows[0];
  const stockAvailable = variantRows.some((variant) => variant.stock_quantity > 0);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: money(numeric(firstPrice ?? row.base_price)),
    images: [{ url: row.image_url || "/placeholder.svg", alt: row.name }],
    category: category ? { id: category.id, slug: category.slug, name: category.name } : null,
    variants: variantRows.map((variant) => ({
      id: variant.id,
      name: variant.name,
      attributes: Object.entries(variant.attributes ?? {}).map(([name, value]) => ({ name, value })),
      price: money(numeric(variant.price_override ?? row.base_price)),
      available: variant.stock_quantity > 0,
    })),
    available: stockAvailable,
  };
}

export async function getProducts(params: { search?: string; categoryId?: number; categorySlug?: string; page?: number; limit?: number; includeUnpublished?: boolean } = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(48, Math.max(1, params.limit ?? 24));
  const values: unknown[] = [];
  const filters = ["p.active = TRUE"];
  if (!params.includeUnpublished) filters.push("p.published = TRUE");
  if (params.search?.trim()) { values.push(`%${params.search.trim()}%`); filters.push(`p.name ILIKE $${values.length}`); }
  if (params.categoryId) { values.push(params.categoryId); filters.push(`EXISTS (SELECT 1 FROM product_category_links l WHERE l.product_id=p.id AND l.category_id=$${values.length})`); }
  if (params.categorySlug) { values.push(params.categorySlug); filters.push(`EXISTS (SELECT 1 FROM product_category_links l JOIN categories c ON c.id=l.category_id WHERE l.product_id=p.id AND c.slug=$${values.length})`); }
  const where = filters.join(" AND ");
  const count = await db.query<{ total: string }>(`SELECT count(*)::text AS total FROM products p WHERE ${where}`, values);
  values.push(limit, (page - 1) * limit);
  const rows = await db.query<ProductRow>(`SELECT p.* FROM products p WHERE ${where} ORDER BY p.updated_at DESC, p.name LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { items: await Promise.all(rows.rows.map(productCard)), page, limit, total: Number(count.rows[0]?.total ?? 0) };
}

export async function getProduct(slug: string) {
  const result = await db.query<ProductRow>("SELECT * FROM products WHERE slug=$1 AND active AND published LIMIT 1", [slug]);
  return result.rows[0] ? productCard(result.rows[0]) : null;
}

export async function getCategories(): Promise<StoreCategory[]> {
  const result = await db.query<CategoryRow>("SELECT id,name,slug,image_url FROM categories WHERE active ORDER BY sequence,name");
  return result.rows.map((item) => ({ id: item.id, name: item.name, slug: item.slug, image: item.image_url }));
}

export async function getCategory(slug: string) {
  const result = await db.query<CategoryRow>("SELECT id,name,slug,image_url FROM categories WHERE slug=$1 AND active LIMIT 1", [slug]);
  const category = result.rows[0];
  if (!category) return null;
  const listing = await getProducts({ categorySlug: slug, limit: 48 });
  return { id: category.id, slug: category.slug, name: category.name, products: listing.items };
}

export async function ensureCart(cartId?: string | null, customerId?: number | null) {
  const id = cartId && /^[0-9a-f-]{36}$/i.test(cartId) ? cartId : randomUUID();
  await db.query(
    `INSERT INTO carts (id, customer_id) VALUES ($1,$2)
     ON CONFLICT (id) DO UPDATE SET customer_id=COALESCE(carts.customer_id, EXCLUDED.customer_id), updated_at=now()`,
    [id, customerId ?? null],
  );
  return id;
}

export async function getCart(cartId: string): Promise<CartSnapshot> {
  const rows = await db.query<{ id: number; quantity: number; variant_id: number; variant_name: string; product_id: number; name: string; slug: string; image_url: string; base_price: string; price_override: string | null; tax_rate: string }>(
    `SELECT cl.id, cl.quantity, v.id AS variant_id, v.name AS variant_name, p.id AS product_id,
       p.name, p.slug, p.image_url, p.base_price, v.price_override, p.tax_rate
     FROM cart_lines cl JOIN product_variants v ON v.id=cl.variant_id JOIN products p ON p.id=v.product_id
     WHERE cl.cart_id=$1 AND p.active AND v.active ORDER BY cl.id`, [cartId]);
  const lines = rows.rows.map((row) => {
    const unit = numeric(row.price_override ?? row.base_price);
    const subtotal = Math.round(unit * row.quantity * 100) / 100;
    const tax = Math.round(subtotal * numeric(row.tax_rate) / 100 * 100) / 100;
    return { id: row.id, product: { id: row.product_id, name: row.name, slug: row.slug, image: row.image_url || "/placeholder.svg" }, variant_name: row.variant_name, quantity: row.quantity, unit_price: money(unit), subtotal: money(subtotal), tax: money(tax), total: money(subtotal + tax) };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal.amount, 0);
  const tax = lines.reduce((sum, line) => sum + line.tax.amount, 0);
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cart = await db.query<{ shipping: string }>(
    `SELECT COALESCE(sm.price,0)::text AS shipping FROM carts c LEFT JOIN shipping_methods sm ON sm.id=c.shipping_method_id AND sm.active WHERE c.id=$1`, [cartId]);
  const shipping = lines.length ? numeric(cart.rows[0]?.shipping) : 0;
  return { id: cartId, lines, quantity, totals: { subtotal: money(subtotal), tax: money(tax), shipping: money(shipping), total: money(subtotal + tax + shipping) } };
}
