export function categoryImage(name: string) {
  const value = name.toLocaleLowerCase("id-ID");
  if (/buah|fruit|semangka|melon/.test(value)) return "/figma/category-fruit.png";
  if (/ayam|daging|protein|ikan|seafood/.test(value)) return "/figma/category-protein.png";
  if (/bumbu|rempah|spice/.test(value)) return "/figma/category-spices.png";
  return "/figma/category-vegetables.png";
}
