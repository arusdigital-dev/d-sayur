const icons: Array<[RegExp, string]> = [
  [/siap masak|paket/i, "🍲"],
  [/umkm|oleh|jajan/i, "🎁"],
  [/ikan|seafood|laut|udang/i, "🐟"],
  [/ayam|daging|unggas|telur/i, "🍗"],
  [/buah/i, "🍊"],
  [/sayur/i, "🥬"],
  [/sembako|bumbu|beras|dapur/i, "🍚"],
];

/** Illustrative category glyph, matched by name so new Odoo categories keep working. */
export function categoryIcon(name: string) {
  return icons.find(([pattern]) => pattern.test(name))?.[1] ?? "🧺";
}
