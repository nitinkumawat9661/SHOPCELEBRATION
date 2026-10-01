import type { GiftProduct } from "./catalog"

// ponytail: English name/category matching until the catalog has an explicit jewelry collection field.
export function isJewelryProduct(product: Pick<GiftProduct, "name" | "category">) {
  return /\b(?:jewelry|jewellery|necklaces?|pendants?|earrings?|rings?(?![-\s]*bound)|bracelets?|bangles?|anklets?|lockets?|brooch(?:es)?|cufflinks?)\b/i.test(`${product.category} ${product.name}`)
}

export type CatalogDiscovery = { view?: string; q?: string; category?: string; sort?: string }

export function discoverProducts(products: GiftProduct[], filters: CatalogDiscovery = {}) {
  const query = filters.q?.trim().toLocaleLowerCase() || ""
  const result = products.filter((product) => product.active !== false
    && (filters.view === "all" || isJewelryProduct(product))
    && (!filters.category || product.category === filters.category)
    && (!query || `${product.name} ${product.category} ${product.note}`.toLocaleLowerCase().includes(query)))
  if (filters.sort === "budget-low") result.sort((a, b) => a.minTier - b.minTier)
  if (filters.sort === "budget-high") result.sort((a, b) => b.minTier - a.minTier)
  if (filters.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}
