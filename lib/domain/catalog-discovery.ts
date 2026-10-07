import type { GiftProduct } from "./catalog"

// ponytail: English name/category matching until the catalog has an explicit jewelry collection field.
export function isJewelryProduct(product: Pick<GiftProduct, "name" | "category">) {
  return /\b(?:jewelry|jewellery|necklaces?|pendants?|earrings?|rings?(?![-\s]*bound)|bracelets?|bangles?|anklets?|lockets?|brooch(?:es)?|cufflinks?)\b/i.test(`${product.category} ${product.name}`)
}

export type CatalogDiscovery = { view?: string; q?: string; category?: string; sort?: string; price?: string }

export function discoverProducts(products: GiftProduct[], filters: CatalogDiscovery = {}) {
  const query = filters.q?.trim().toLocaleLowerCase() || ""
  const result = products.filter((product) => {
    if (product.active === false) return false
    if (filters.view !== "all" && !isJewelryProduct(product)) return false
    if (filters.category && product.category !== filters.category) return false
    if (query && !`${product.name} ${product.category} ${product.note}`.toLocaleLowerCase().includes(query)) return false

    if (filters.price) {
      const price = typeof product.salePricePaise === "number" ? product.salePricePaise / 100 : null
      if (price === null) return false
      if (filters.price === "under-120" && price >= 120) return false
      if (filters.price === "120-149" && (price < 120 || price > 149)) return false
      if (filters.price === "150-179" && (price < 150 || price > 179)) return false
      if (filters.price === "180-plus" && price < 180) return false
    }
    return true
  })

  const salePrice = (product: GiftProduct) => typeof product.salePricePaise === "number" ? product.salePricePaise : Number.MAX_SAFE_INTEGER
  if (filters.sort === "price-low" || filters.sort === "budget-low") result.sort((a, b) => salePrice(a) - salePrice(b))
  if (filters.sort === "price-high" || filters.sort === "budget-high") result.sort((a, b) => salePrice(b) - salePrice(a))
  if (filters.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}
