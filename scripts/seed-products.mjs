import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL in .env.local first.");

const catalog = [
  { name: "Bayam Hijau", slug: "bayam-hijau", category: "sayuran", sku: "DS-SAY-001", variant: "Ikat (250 g)", price: 6000, stock: 35, description: "Bayam hijau segar pilihan, cocok untuk sayur bening dan tumisan." },
  { name: "Kangkung Segar", slug: "kangkung-segar", category: "sayuran", sku: "DS-SAY-002", variant: "Ikat (250 g)", price: 5000, stock: 40, description: "Kangkung segar dengan batang renyah, siap diolah menjadi tumisan." },
  { name: "Sawi Hijau", slug: "sawi-hijau", category: "sayuran", sku: "DS-SAY-003", variant: "Ikat (250 g)", price: 7000, stock: 28, description: "Sawi hijau segar untuk sup, mi, dan aneka masakan rumahan." },
  { name: "Wortel Lokal", slug: "wortel-lokal", category: "sayuran", sku: "DS-SAY-004", variant: "Paket (500 g)", price: 12000, stock: 24, description: "Wortel lokal berwarna cerah dan manis, cocok untuk sup dan jus." },
  { name: "Tomat Merah", slug: "tomat-merah", category: "sayuran", sku: "DS-SAY-005", variant: "Paket (500 g)", price: 10000, stock: 30, description: "Tomat merah segar untuk sambal, masakan, dan minuman." },
  { name: "Kentang Dieng", slug: "kentang-dieng", category: "sayuran", sku: "DS-SAY-006", variant: "Paket (1 kg)", price: 18000, stock: 20, description: "Kentang pilihan dari Dieng, serbaguna untuk berbagai hidangan." },
  { name: "Bawang Merah", slug: "bawang-merah", category: "bahan-dapur", sku: "DS-DAP-001", variant: "Paket (250 g)", price: 14000, stock: 25, description: "Bawang merah pilihan sebagai bumbu dasar masakan sehari-hari." },
  { name: "Cabai Rawit Merah", slug: "cabai-rawit-merah", category: "bahan-dapur", sku: "DS-DAP-002", variant: "Paket (100 g)", price: 12000, stock: 18, description: "Cabai rawit merah segar untuk sambal dan masakan pedas." },
  { name: "Pisang Cavendish", slug: "pisang-cavendish", category: "buah-buahan", sku: "DS-BUA-001", variant: "Sisir kecil", price: 22000, stock: 16, description: "Pisang Cavendish matang pilihan dengan rasa manis dan tekstur lembut." },
  { name: "Apel Fuji", slug: "apel-fuji", category: "buah-buahan", sku: "DS-BUA-002", variant: "Paket (3 buah)", price: 28000, stock: 14, description: "Apel Fuji renyah dan manis, cocok untuk camilan keluarga." },
  { name: "Jeruk Medan", slug: "jeruk-medan", category: "buah-buahan", sku: "DS-BUA-003", variant: "Paket (1 kg)", price: 26000, stock: 18, description: "Jeruk Medan segar dengan rasa manis-asam yang menyegarkan." },
  { name: "Alpukat Mentega", slug: "alpukat-mentega", category: "buah-buahan", sku: "DS-BUA-004", variant: "Paket (2 buah)", price: 24000, stock: 12, description: "Alpukat mentega bertekstur lembut, nikmat untuk jus atau hidangan." },
];

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  let inserted = 0;
  for (const item of catalog) {
    const product = await client.query(
      `INSERT INTO products (name, slug, description, base_price, image_url, published)
       VALUES ($1,$2,$3,$4,'/placeholder.svg',TRUE)
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [item.name, item.slug, item.description, item.price],
    );
    if (!product.rows[0]) continue;
    const category = await client.query("SELECT id FROM categories WHERE slug=$1 AND active", [item.category]);
    if (!category.rows[0]) throw new Error(`Missing category: ${item.category}`);
    await client.query("INSERT INTO product_category_links (product_id,category_id) VALUES ($1,$2)", [product.rows[0].id, category.rows[0].id]);
    await client.query(
      "INSERT INTO product_variants (product_id,sku,name,stock_quantity) VALUES ($1,$2,$3,$4) ON CONFLICT (sku) DO NOTHING",
      [product.rows[0].id, item.sku, item.variant, item.stock],
    );
    inserted += 1;
  }
  await client.query("COMMIT");
  console.log(`Product seed selesai: ${inserted} produk baru ditambahkan; produk yang sudah ada tidak diubah.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
