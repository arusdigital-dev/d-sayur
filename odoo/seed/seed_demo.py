"""D-Sayur demo seed — run through the Odoo shell (service may keep running):

    "<odoo>\\python\\python.exe" odoo-bin shell -c odoo.conf -d dsayur --http-port 8093 < odoo\\seed\\seed_demo.py

Idempotent: re-running updates/skips what exists. Everything created here is DUMMY data
(placeholder images, sample prices, fictional UMKM) for the closed OTS demo only.
"""
import base64
import colorsys
import hashlib
import struct
import zlib
from datetime import datetime, timedelta

website = env["website"].search([], limit=1)
company = env.company
print("website:", website.name, "| currency:", company.currency_id.name)

# ---------------------------------------------------------------- currency: the shop sells in Rupiah
idr = env.ref("base.IDR")
idr.active = True
if company.currency_id != idr:
    try:
        with env.cr.savepoint():
            company.currency_id = idr
        print("company currency -> IDR")
    except Exception as error:  # accounting entries may already exist
        print("WARNING: could not switch company currency to IDR:", str(error).splitlines()[0])
for pricelist in env["product.pricelist"].search([]):
    if pricelist.currency_id != idr:
        pricelist.currency_id = idr
print("pricelists:", [(p.name, p.currency_id.name) for p in env["product.pricelist"].search([])])


# ---------------------------------------------------------------- placeholder images
def _png(width, height, pixel):
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend(pixel(x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")


def placeholder(seed, hue):
    size = 320
    digest = hashlib.sha256(seed.encode()).digest()
    cx, cy = 120 + digest[0] % 80, 130 + digest[1] % 60
    radius = 85 + digest[2] % 35
    leaf = (cx + 55 + digest[3] % 20, cy - radius + 10)
    base = tuple(int(v * 255) for v in colorsys.hsv_to_rgb(hue, 0.55, 0.85))
    shade = tuple(int(v * 255) for v in colorsys.hsv_to_rgb(hue, 0.7, 0.55))
    leaf_color = tuple(int(v * 255) for v in colorsys.hsv_to_rgb(0.30, 0.55, 0.55))

    def pixel(x, y):
        bg = 250 - (y * 22) // size
        color = (bg, bg - 3, bg - 14)
        dx, dy = x - cx, y - cy
        if dx * dx + dy * dy < radius * radius:
            light = max(0.0, 1 - (((dx + 30) ** 2 + (dy + 30) ** 2) ** 0.5) / (radius * 1.5))
            color = tuple(int(shade[i] + (base[i] - shade[i]) * (0.35 + 0.65 * light)) for i in range(3))
        elif (x - leaf[0]) ** 2 + (y - leaf[1]) ** 2 < 24 * 24:
            color = leaf_color
        elif y > size - 60 and (y - (size - 60)) * 2 > abs(x - size // 2) * 0.1:
            color = (bg - 18, bg - 22, bg - 34)
        return color

    return base64.b64encode(_png(size, size, pixel)).decode()


# ---------------------------------------------------------------- catalog
CATEGORIES = {
    "Sayur": 0.30,
    "Buah": 0.08,
    "Ikan & Seafood": 0.55,
    "Ayam & Daging": 0.02,
    "Sembako & Bumbu": 0.11,
    "Paket Siap Masak": 0.35,
    "Produk UMKM & Oleh-oleh": 0.07,
}

# name, category, price, unit label, weight(kg) for per-kg price, badge, weighed, stock, description
P = []


def add(name, cat, price, unit, weight, badge, weighed, stock, desc, umkm=None):
    P.append(dict(name=name, cat=cat, price=price, unit=unit, weight=weight, badge=badge, weighed=weighed, stock=stock, desc=desc, umkm=umkm))


S, B, I, A, K, R, U = list(CATEGORIES)
add("Bayam Hijau", S, 5000, "per ikat", 0.25, "harvest_today", False, 60, "Bayam segar dipetik pagi hari, cocok untuk sayur bening.")
add("Kangkung", S, 4000, "per ikat", 0.3, "harvest_today", False, 60, "Kangkung darat renyah untuk tumis atau cah.")
add("Sawi Hijau", S, 6000, "per 250 g", 0.25, "harvest_today", True, 50, "Sawi hijau segar untuk tumisan dan sup.")
add("Wortel", S, 9000, "per 500 g", 0.5, None, True, 80, "Wortel manis, renyah, cocok untuk sop dan capcay.")
add("Kentang", S, 8000, "per 500 g", 0.5, None, True, 80, "Kentang untuk sup, balado, atau kentang goreng.")
add("Tomat Merah", S, 7000, "per 500 g", 0.5, None, True, 70, "Tomat merah matang untuk sambal dan masakan harian.")
add("Cabai Merah Keriting", S, 14000, "per 250 g", 0.25, None, True, 40, "Cabai merah keriting pedas segar.")
add("Cabai Rawit Hijau", S, 12000, "per 250 g", 0.25, None, True, 40, "Cabai rawit hijau, pedasnya mantap.")
add("Bawang Merah", S, 11000, "per 250 g", 0.25, None, True, 90, "Bawang merah pilihan untuk bumbu dasar.")
add("Bawang Putih", S, 9000, "per 250 g", 0.25, None, True, 90, "Bawang putih kating, aromanya kuat.")
add("Jagung Manis", S, 5000, "per buah", None, "harvest_today", False, 45, "Jagung manis, empuk saat direbus.")
add("Terong Ungu", S, 6000, "per 500 g", 0.5, None, True, 40, "Terong ungu untuk balado atau tumis.")
add("Buncis", S, 8000, "per 250 g", 0.25, None, True, 40, "Buncis muda renyah.")
add("Kol Putih", S, 7000, "per 500 g", 0.5, None, True, 40, "Kol putih untuk sup, lalapan, dan tumisan.")
add("Timun", S, 5000, "per 500 g", 0.5, None, True, 55, "Timun segar untuk lalapan dan acar.")
add("Pisang Cavendish", B, 22000, "per sisir", None, None, True, 30, "Pisang cavendish manis dan harum.")
add("Jeruk Mandarin", B, 28000, "per kg", 1.0, None, True, 30, "Jeruk mandarin manis segar.")
add("Apel Fuji", B, 6000, "per buah", None, None, False, 60, "Apel fuji renyah dan manis.")
add("Semangka Merah", B, 18000, "per kg", 1.0, None, True, 25, "Semangka merah tanpa biji besar, segar dingin.")
add("Pepaya California", B, 16000, "per kg", 1.0, None, True, 25, "Pepaya california manis, daging tebal.")
add("Mangga Harum Manis", B, 30000, "per kg", 1.0, None, True, 20, "Mangga harum manis berdaging tebal.")
add("Nanas Madu", B, 15000, "per buah", None, "harvest_today", False, 25, "Nanas madu manis, rendah serat.")
add("Jeruk Nipis", B, 9000, "per 250 g", 0.25, None, True, 45, "Jeruk nipis segar untuk sambal dan minuman.")
add("Melon Hijau", B, 20000, "per kg", 1.0, None, True, 20, "Melon hijau manis dan juicy.")
add("Ikan Kakap Hidup", I, 85000, "per kg", 1.0, "live_fish", True, 30, "Ikan kakap hidup dari nelayan lokal; dibersihkan sesuai permintaan.")
add("Ikan Kerapu Hidup", I, 120000, "per kg", 1.0, "live_fish", True, 20, "Ikan kerapu hidup, cocok dikukus atau dibakar.")
add("Ikan Tongkol Segar", I, 38000, "per kg", 1.0, None, True, 40, "Tongkol segar untuk gulai atau balado.")
add("Ikan Tenggiri", I, 70000, "per kg", 1.0, None, True, 30, "Tenggiri segar, bagus untuk otak-otak dan pempek.")
add("Udang Segar", I, 75000, "per kg", 1.0, None, True, 30, "Udang segar ukuran sedang.")
add("Cumi-cumi Segar", I, 65000, "per kg", 1.0, None, True, 30, "Cumi-cumi segar, kenyal dan manis.")
add("Kepiting Bakau", I, 110000, "per kg", 1.0, "live_fish", True, 12, "Kepiting bakau hidup.")
add("Ikan Bilis Basah", I, 30000, "per 500 g", 0.5, None, True, 25, "Ikan bilis basah untuk digoreng atau dibuat sambal.")
add("Ayam Broiler Utuh", A, 38000, "per kg", 1.0, None, True, 40, "Ayam broiler segar utuh; bisa dipotong sesuai catatan.")
add("Dada Ayam Fillet", A, 42000, "per kg", 1.0, None, True, 40, "Dada ayam fillet tanpa tulang.")
add("Paha Ayam", A, 40000, "per kg", 1.0, None, True, 40, "Paha ayam segar.")
add("Sayap Ayam", A, 36000, "per kg", 1.0, None, True, 30, "Sayap ayam segar untuk digoreng atau dipanggang.")
add("Daging Sapi Sengkel", A, 135000, "per kg", 1.0, None, True, 20, "Daging sapi sengkel untuk soto dan rawon.")
add("Daging Sapi Giling", A, 125000, "per kg", 1.0, None, True, 20, "Daging sapi giling untuk bakso dan perkedel.")
add("Telur Ayam Negeri", A, 28000, "per 10 butir", None, None, False, 70, "Telur ayam negeri segar.")
add("Telur Ayam Kampung", A, 38000, "per 10 butir", None, None, False, 40, "Telur ayam kampung.")
add("Beras Pandan Wangi", K, 72000, "per 5 kg", 5.0, None, False, 50, "Beras pulen wangi pandan.")
add("Minyak Goreng", K, 19000, "per 1 liter", None, None, False, 80, "Minyak goreng kemasan 1 liter.")
add("Gula Pasir", K, 17000, "per 1 kg", 1.0, None, False, 70, "Gula pasir putih.")
add("Garam Dapur", K, 4000, "per bungkus", None, None, False, 70, "Garam dapur beryodium.")
add("Santan Kelapa", K, 8000, "per 250 ml", None, None, False, 50, "Santan kelapa segar.")
add("Bumbu Halus Dasar Merah", K, 12000, "per 200 g", 0.2, "ready_to_cook", False, 35, "Bumbu halus dasar merah siap pakai.")
add("Bumbu Halus Dasar Putih", K, 12000, "per 200 g", 0.2, "ready_to_cook", False, 35, "Bumbu halus dasar putih siap pakai.")
add("Kecap Manis", K, 14000, "per 275 ml", None, None, False, 60, "Kecap manis kental.")
add("Tepung Terigu", K, 13000, "per 1 kg", 1.0, None, False, 50, "Tepung terigu serbaguna.")
add("Mi Telur", K, 6000, "per bungkus", None, None, False, 60, "Mi telur untuk mi goreng dan mi kuah.")
add("Paket Sayur Sop", R, 7000, "per pack", None, "ready_to_cook", False, 40, "Wortel, kentang, kol, seledri, dan bumbu sop. Cukup untuk 3–4 porsi.")
add("Paket Capcay", R, 9000, "per pack", None, "ready_to_cook", False, 40, "Aneka sayur capcay segar lengkap bumbunya.")
add("Paket Tumis Kangkung", R, 7000, "per pack", None, "ready_to_cook", False, 40, "Kangkung, bawang, cabai, dan terasi siap tumis.")
add("Paket Sayur Asem", R, 8000, "per pack", None, "ready_to_cook", False, 35, "Jagung, labu siam, kacang panjang, dan bumbu asem.")
add("Paket Soto Ayam", R, 15000, "per pack", None, "ready_to_cook", False, 30, "Bumbu soto, ayam suwir, soun, dan pelengkap.")
add("Paket Pepes Ikan", R, 18000, "per pack", None, "ready_to_cook", False, 25, "Ikan, bumbu, dan daun pisang siap dikukus.")
add("Otak-otak Ikan Tenggiri", U, 25000, "per 10 pcs", None, "umkm", False, 40, "Otak-otak ikan tenggiri khas Kepri, dibakar dengan daun.", ("Dapur Bunda Kepri (contoh)", "Tanjungpinang", "Resep keluarga yang diwariskan tiga generasi; dibuat dari ikan tenggiri segar tiap pagi."))
add("Kerupuk Kemplang", U, 18000, "per pack", None, "umkm", False, 50, "Kemplang ikan renyah, oleh-oleh favorit.", ("UMKM Sari Laut (contoh)", "Bintan", "Dijemur alami dan dipanggang, tanpa pengawet tambahan."))
add("Keripik Pisang", U, 15000, "per pack", None, "umkm", False, 50, "Keripik pisang manis gurih.", ("Keripik Mak Cik (contoh)", "Tanjungpinang", "Pisang pilihan diiris tipis dan digoreng dengan minyak baru."))
add("Dodol Nanas", U, 22000, "per pack", None, "umkm", False, 35, "Dodol nanas legit dari nanas Bintan.", ("Dodol Tepian Laut (contoh)", "Bintan", "Diaduk perlahan di atas tungku kayu hingga kental."))
add("Sambal Teri Pedas", U, 20000, "per botol", None, "umkm", False, 45, "Sambal teri pedas tahan lama.", ("Sambal Bu Ningsih (contoh)", "Tanjungpinang", "Teri nasi digoreng garing lalu diulek dengan cabai rawit."))
add("Ikan Asin Bilis", U, 24000, "per pack", None, "umkm", False, 40, "Ikan bilis kering bersih.", ("Nelayan Mandiri (contoh)", "Pulau Penyengat", "Dijemur di pesisir; dikemas rapi dan aman dibawa sebagai oleh-oleh."))
add("Bolu Kemojo", U, 28000, "per kotak", None, "umkm", False, 30, "Bolu kemojo khas Melayu, lembut dan harum.", ("Kue Melayu Kak Ros (contoh)", "Tanjungpinang", "Kue tradisional Melayu dengan santan dan telur kampung."))
add("Kue Bangkit", U, 30000, "per toples", None, "umkm", False, 30, "Kue bangkit lumer di mulut.", ("Toples Kita (contoh)", "Tanjungpinang", "Dibuat dengan tepung sagu dan santan, dikemas toples kedap udara."))

# ---------------------------------------------------------------- categories
category_records = {}
for index, (name, hue) in enumerate(CATEGORIES.items(), start=1):
    record = env["product.public.category"].search([("name", "=", name)], limit=1)
    if not record:
        record = env["product.public.category"].create({"name": name, "sequence": index})
    record.image_1920 = placeholder("cat-" + name, hue)
    category_records[name] = (record, hue)
print("categories:", len(category_records))

# ---------------------------------------------------------------- products + stock
warehouse = env["stock.warehouse"].search([("company_id", "=", company.id)], limit=1)
location = warehouse.lot_stock_id
created = updated = 0
for item in P:
    category, hue = category_records[item["cat"]]
    values = {
        "name": item["name"],
        "list_price": item["price"],
        "type": "consu",
        "is_storable": True,
        "sale_ok": True,
        "purchase_ok": True,
        "is_published": True,
        "website_id": False,
        "public_categ_ids": [(6, 0, category.ids)],
        "description_sale": item["desc"],
        "weight": item["weight"] or 0.0,
        "dsayur_badge": item["badge"] or False,
        "dsayur_sale_unit_label": item["unit"],
        "dsayur_weighed": item["weighed"],
    }
    if item["umkm"]:
        values.update(dsayur_umkm_name=item["umkm"][0], dsayur_umkm_origin=item["umkm"][1], dsayur_umkm_story=item["umkm"][2])
    template = env["product.template"].search([("name", "=", item["name"])], limit=1)
    if template:
        template.write(values)
        updated += 1
    else:
        values["image_1920"] = placeholder(item["name"], hue)
        template = env["product.template"].create(values)
        created += 1
    variant = template.product_variant_id
    if variant.free_qty < item["stock"]:
        env["stock.quant"]._update_available_quantity(variant, location, item["stock"] - variant.free_qty)
print(f"products created={created} updated={updated}")

# ---------------------------------------------------------------- delivery slots
Slot = env["dsayur.delivery.slot"]
jakarta = timedelta(hours=7)
today = datetime.utcnow() + jakarta
windows = [("Pagi", 6, 9, "all", 12), ("Siang", 11, 14, "all", 12), ("Sore", 16, 19, "all", 12), ("Pagi prioritas Gold", 5, 6, "gold", 4)]
slots = 0
for day in range(1, 8):
    date = (today + timedelta(days=day)).replace(hour=0, minute=0, second=0, microsecond=0)
    for label, start_h, end_h, priority, capacity in windows:
        start = date + timedelta(hours=start_h) - jakarta
        end = date + timedelta(hours=end_h) - jakarta
        if Slot.search_count([("start_at", "=", start), ("priority_tier", "=", priority)]):
            continue
        Slot.create({"name": f"{label} · {date:%a %d/%m} {start_h:02d}.00–{end_h:02d}.00", "start_at": start, "end_at": end, "capacity": capacity, "priority_tier": priority})
        slots += 1
print("delivery slots created:", slots)

# ---------------------------------------------------------------- carriers: only the two D-Sayur methods are offered
for xmlid in ("delivery.delivery_carrier", "delivery.free_delivery_carrier"):
    carrier = env.ref(xmlid, raise_if_not_found=False)
    if carrier and carrier.active:
        carrier.active = False
        print("archived demo carrier:", carrier.name)
for xmlid in ("dsayur_headless.dsayur_delivery_pickup", "dsayur_headless.dsayur_delivery_routes"):
    env.ref(xmlid).write({"is_published": True, "active": True})

# ---------------------------------------------------------------- payment: manual transfer for the sandbox demo
provider = env["payment.provider"].search([("code", "=", "custom")], limit=1)
if provider:
    provider.write({"active": True, "is_published": True, "name": "Transfer / QRIS manual (demo)"})
    provider.company_id = company
    print("custom payment provider:", provider.name, "| methods:", provider.primary_payment_method_ids.mapped("name"))
else:
    print("WARNING: payment_custom provider not found")

# ---------------------------------------------------------------- demo customers (one per tier)
Users = env["res.users"].with_context(no_reset_password=True)
valid_until = (today.replace(day=28) + timedelta(days=40)).replace(day=1) - timedelta(days=1)
store_lat = float(env["ir.config_parameter"].sudo().get_str("dsayur_headless.store_latitude", "0.9189193"))
store_lng = float(env["ir.config_parameter"].sudo().get_str("dsayur_headless.store_longitude", "104.505651"))
portal = env.ref("base.group_portal")
for tier, name in (("bronze", "Bu Rina (Bronze)"), ("silver", "Dimas (Silver)"), ("gold", "Pak Hendra (Gold)")):
    login = f"{tier}@dsayur.demo"
    user = env["res.users"].search([("login", "=", login)], limit=1)
    if not user:
        user = Users.create({"name": name, "login": login, "email": login, "password": "demo1234", "group_ids": [(6, 0, portal.ids)]})
    partner = user.partner_id
    partner.write({"dsayur_tier": tier, "dsayur_tier_valid_until": valid_until if tier != "bronze" else False, "dsayur_tier_month": today.strftime("%Y-%m")})
    if not partner.child_ids.filtered(lambda row: row.type == "delivery"):
        env["res.partner"].create({
            "parent_id": partner.id, "type": "delivery", "name": name, "street": "Alamat demo, Tanjungpinang", "city": "Tanjungpinang",
            "zip": "29124", "country_id": env.ref("base.id").id, "partner_latitude": store_lat + 0.012, "partner_longitude": store_lng - 0.01,
        })
    print("demo user:", login, "/ demo1234 ->", tier)

# staff account for the closed demo: sales manager + inventory manager (admin UI in Next.js and Odoo backend)
staff_login = "staff@dsayur.demo"
if not env["res.users"].search([("login", "=", staff_login)], limit=1):
    groups = env.ref("base.group_user") | env.ref("sales_team.group_sale_manager") | env.ref("stock.group_stock_manager")
    Users.create({"name": "Staf D-Sayur (demo)", "login": staff_login, "email": staff_login, "password": "demo1234", "group_ids": [(6, 0, groups.ids)]})
print("staff user:", staff_login, "/ demo1234")

env.cr.commit()
print("SEED DONE")
