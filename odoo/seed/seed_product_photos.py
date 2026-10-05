"""Replace seeded product placeholders with freely licensed product photos.

Run from the repository root through the Odoo shell. Images and license metadata
are fetched from Wikimedia Commons; all photo downloads finish before any Odoo
record is changed, so a network/license failure leaves the catalog untouched.
"""
import base64
import hashlib
import html
import json
import re
import tempfile
import time
from urllib.error import HTTPError, URLError
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SEARCH_TERMS = {
    "Bayam Hijau": "fresh spinach leaves bunch",
    "Kangkung": "water spinach kangkong vegetable",
    "Sawi Hijau": "mustard greens vegetable",
    "Wortel": "fresh carrots vegetable",
    "Kentang": "fresh potatoes vegetable",
    "Tomat Merah": "fresh red tomatoes",
    "Cabai Merah Keriting": "red chili peppers fresh",
    "Cabai Rawit Hijau": "green bird eye chili peppers",
    "Bawang Merah": "shallots onion",
    "Bawang Putih": "garlic bulbs",
    "Jagung Manis": "sweet corn cob",
    "Terong Ungu": "purple eggplant aubergine",
    "Buncis": "green beans vegetable",
    "Kol Putih": "white cabbage vegetable",
    "Timun": "fresh cucumber",
    "Pisang Cavendish": "cavendish banana bunch",
    "Jeruk Mandarin": "mandarin orange fruit",
    "Apel Fuji": "fuji apple fruit",
    "Semangka Merah": "red watermelon fruit",
    "Pepaya California": "ripe papaya fruit",
    "Mangga Harum Manis": "ripe mango fruit",
    "Nanas Madu": "fresh pineapple fruit",
    "Jeruk Nipis": "lime fruit",
    "Melon Hijau": "green melon fruit",
    "Ikan Kakap Hidup": "red snapper fish fresh",
    "Ikan Kerapu Hidup": "grouper fish fresh",
    "Ikan Tongkol Segar": "fresh tuna mackerel fish",
    "Ikan Tenggiri": "spanish mackerel fish",
    "Udang Segar": "fresh shrimp prawns",
    "Cumi-cumi Segar": "fresh squid seafood",
    "Kepiting Bakau": "mud crab fresh seafood",
    "Ikan Bilis Basah": "anchovy fish fresh",
    "Ayam Broiler Utuh": "whole raw chicken",
    "Dada Ayam Fillet": "raw chicken breast fillet",
    "Paha Ayam": "raw chicken thigh",
    "Sayap Ayam": "raw chicken wings",
    "Daging Sapi Sengkel": "raw beef shank meat",
    "Daging Sapi Giling": "raw ground beef mince",
    "Telur Ayam Negeri": "fresh chicken eggs",
    "Telur Ayam Kampung": "free range chicken eggs",
    "Beras Pandan Wangi": "uncooked jasmine rice grains",
    "Minyak Goreng": "cooking oil bottle",
    "Gula Pasir": "granulated white sugar",
    "Garam Dapur": "salt crystals bowl",
    "Santan Kelapa": "coconut milk bowl",
    "Bumbu Halus Dasar Merah": "red curry spice paste",
    "Bumbu Halus Dasar Putih": "white spice paste garlic ginger",
    "Kecap Manis": "sweet soy sauce bottle",
    "Tepung Terigu": "wheat flour bowl",
    "Mi Telur": "egg noodles uncooked",
    "Paket Sayur Sop": "vegetable soup ingredients carrots potatoes cabbage",
    "Paket Capcay": "chop suey mixed vegetables",
    "Paket Tumis Kangkung": "stir fried water spinach vegetables",
    "Paket Sayur Asem": "indonesian sayur asem vegetables",
    "Paket Soto Ayam": "indonesian chicken soto soup ingredients",
    "Paket Pepes Ikan": "indonesian pepes fish banana leaf",
    "Otak-otak Ikan Tenggiri": "grilled fish cake banana leaf otak otak",
    "Kerupuk Kemplang": "indonesian fish crackers kerupuk",
    "Keripik Pisang": "banana chips snack",
    "Dodol Nanas": "pineapple dodol sweets",
    "Sambal Teri Pedas": "anchovy chili sambal jar",
    "Ikan Asin Bilis": "dried anchovies salted fish",
    "Bolu Kemojo": "indonesian pandan cake bolu kemojo",
    "Kue Bangkit": "indonesian tapioca cookies kue bangkit",
}

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DSayurDemoSeeder/1.0 (local storefront catalog image refresh)"
ALLOWED_LICENSES = {
    "CC0 1.0", "CC0", "Public domain", "Public domain mark", "PDM 1.0",
    "CC BY 2.0", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
FALLBACK_SEARCH_TERMS = {
    "Dada Ayam Fillet": ("raw chicken breast", "Raw chicken slices", "chicken breast meat"),
    "Paha Ayam": ("raw chicken thighs", "chicken thigh uncooked"),
    "Sayap Ayam": ("raw chicken wings", "uncooked chicken wings"),
    "Daging Sapi Sengkel": ("raw beef shank", "beef shank meat"),
    "Daging Sapi Giling": ("raw ground beef", "ground beef uncooked"),
    "Beras Pandan Wangi": ("uncooked rice grains", "jasmine rice grains", "rice grains"),
    "Minyak Goreng": ("cooking oil bottle", "vegetable oil bottle"),
    "Gula Pasir": ("granulated sugar", "white sugar crystals"),
    "Garam Dapur": ("table salt crystals", "salt bowl"),
    "Santan Kelapa": ("coconut milk", "coconut cream"),
    "Bumbu Halus Dasar Merah": ("red spice paste", "chili spice paste"),
    "Bumbu Halus Dasar Putih": ("garlic ginger spice paste", "white curry paste"),
    "Kecap Manis": ("sweet soy sauce bottle", "kecap manis"),
    "Tepung Terigu": ("wheat flour", "all purpose flour"),
    "Mi Telur": ("uncooked egg noodles", "egg noodles"),
    "Paket Sayur Sop": ("soup vegetables carrots potatoes cabbage", "vegetable soup ingredients"),
    "Paket Capcay": ("mixed vegetables stir fry", "chop suey vegetables"),
    "Paket Tumis Kangkung": ("water spinach vegetables", "kangkong vegetable"),
    "Paket Sayur Asem": ("indonesian vegetables tamarind soup", "sayur asem vegetables"),
    "Paket Soto Ayam": ("indonesian chicken soup ingredients", "soto ayam"),
    "Paket Pepes Ikan": ("fish banana leaf wrapped", "pepes ikan"),
    "Otak-otak Ikan Tenggiri": ("fish cake banana leaf", "otak otak fish cake"),
    "Kerupuk Kemplang": ("indonesian fish crackers", "fish crackers"),
    "Keripik Pisang": ("banana chips", "banana crisps"),
    "Dodol Nanas": ("pineapple sweets", "pineapple candy"),
    "Sambal Teri Pedas": ("anchovy chili sambal", "chili anchovy sauce"),
    "Ikan Asin Bilis": ("dried salted anchovies", "dried anchovy fish"),
    "Bolu Kemojo": ("pandan cake", "indonesian pandan cake"),
    "Kue Bangkit": ("tapioca cookies", "indonesian cookies"),
}
STAGE_DIR = Path(tempfile.gettempdir()) / "dsayur-product-photo-stage"


def open_with_retries(request, timeout):
    for attempt in range(7):
        try:
            return urlopen(request, timeout=timeout)
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 6:
                raise
            retry_after = error.headers.get("Retry-After", "")
            delay = min(float(retry_after), 90) if retry_after.isdigit() else min(3 * (2 ** attempt), 60)
            print(f"Wikimedia membatasi permintaan; mencoba lagi dalam {delay:.0f} detik...")
            time.sleep(delay)
        except URLError:
            if attempt == 6:
                raise
            delay = min(3 * (2 ** attempt), 60)
            print(f"Koneksi Wikimedia terputus; mencoba lagi dalam {delay} detik...")
            time.sleep(delay)


def text_value(metadata, key):
    raw = metadata.get(key, {})
    value = raw.get("value", "") if isinstance(raw, dict) else ""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", value))).strip()


def commons_photo(product_name, terms):
    for query in (terms, *FALLBACK_SEARCH_TERMS.get(product_name, ())):
        params = urlencode({
            "action": "query", "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": 720, "format": "json",
        })
        request = Request(f"{API}?{params}", headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        with open_with_retries(request, timeout=25) as response:
            data = json.loads(response.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        candidates = sorted(pages.values(), key=lambda page: ("photo" not in page.get("title", "").lower(), page.get("title", "")))
        for page in candidates:
            info = (page.get("imageinfo") or [{}])[0]
            metadata = info.get("extmetadata", {})
            license_name = text_value(metadata, "LicenseShortName")
            if license_name not in ALLOWED_LICENSES:
                continue
            url = info.get("thumburl") or info.get("url")
            if not url:
                continue
            image_request = Request(url, headers={"User-Agent": USER_AGENT})
            with open_with_retries(image_request, timeout=30) as image_response:
                image = image_response.read(6_000_001)
                content_type = image_response.headers.get("Content-Type", "")
            if len(image) > 6_000_000 or not content_type.startswith("image/"):
                continue
            if not image.startswith((b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")):
                continue
            artist = text_value(metadata, "Artist") or "Tidak dicantumkan"
            source_page = info.get("descriptionurl", "")
            credit = f"{artist} / Wikimedia Commons / {license_name}"
            return image, {
                "product": product_name,
                "file": page.get("title", ""),
                "source": source_page,
                "author": artist,
                "license": license_name,
                "license_url": text_value(metadata, "LicenseUrl"),
                "credit": credit,
            }
    raise RuntimeError(f"Tidak menemukan foto berlisensi bebas yang cocok untuk {product_name!r} ({terms}).")


print("Mengambil foto produk berlisensi bebas dari Wikimedia Commons…")
Product = env["product.template"].sudo()
prepared = []
credits = []
for index, (name, terms) in enumerate(SEARCH_TERMS.items(), start=1):
    records = Product.search([("name", "=", name), ("sale_ok", "=", True)], limit=1)
    if not records:
        raise RuntimeError(f"Produk Odoo tidak ditemukan: {name}")
    cache_key = hashlib.sha256(name.encode("utf-8")).hexdigest()
    cached_image = STAGE_DIR / f"{cache_key}.image"
    cached_credit = STAGE_DIR / f"{cache_key}.json"
    if cached_image.exists() and cached_credit.exists():
        image = cached_image.read_bytes()
        credit = json.loads(cached_credit.read_text(encoding="utf-8"))
    else:
        image, credit = commons_photo(name, terms)
        STAGE_DIR.mkdir(parents=True, exist_ok=True)
        cached_image.write_bytes(image)
        cached_credit.write_text(json.dumps(credit, ensure_ascii=False), encoding="utf-8")
    prepared.append((records, base64.b64encode(image).decode("ascii")))
    credits.append(credit)
    print(f"[{index}/{len(SEARCH_TERMS)}] siap: {name} — {credit['license']}")
    time.sleep(1.25)

print("Semua foto siap; memperbarui gambar produk di Odoo…")
for records, image in prepared:
    records.write({"image_1920": image})

credits_path = Path.cwd() / "odoo" / "seed" / "product_photo_credits.json"
credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
env.cr.commit()
print(f"Foto produk diperbarui: {len(prepared)}; kredit lisensi: {credits_path}")
print("SEED PRODUCT PHOTOS DONE")
