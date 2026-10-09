import type { GiftProduct } from "./catalog"

// ponytail: English name/category matching until the catalog has an explicit jewelry collection field.
export function isJewelryProduct(product: Pick<GiftProduct, "name" | "category">) {
  return /\b(?:jewelry|jewellery|necklaces?|pendants?|earrings?|rings?(?![-\s]*bound)|bracelets?|bangles?|anklets?|lockets?|brooch(?:es)?|cufflinks?)\b/i.test(`${product.category} ${product.name}`)
}

export type CatalogDiscovery = { view?: string; q?: string; category?: string; sort?: string; price?: string }

export function discoverProducts(products: GiftProduct[], filters: CatalogDiscovery = {}) {
  const terms = (filters.q || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const result = products.filter((product) => {
    if (product.active === false) return false
    if (filters.view !== "all" && !isJewelryProduct(product)) return false
    if (filters.category && product.category !== filters.category) return false
    if (terms.length) {
      const searchable = [product.name, product.category, product.note, product.description, ...(product.highlights || [])]
        .filter(Boolean).join(" ").toLocaleLowerCase()
      if (!terms.every((term) => searchable.includes(term))) return false
    }

    // Compare paise with half-open intervals so ₹149.50 and ₹179.50
    // don't fall between adjacent price brackets.
    if (filters.price) {
      const price = product.sellIndividually === true && typeof product.salePricePaise === "number"
        ? product.salePricePaise : null
      if (price === null) return false
      if (filters.price === "under-120" && price >= 12000) return false
      if (filters.price === "120-149" && (price < 12000 || price >= 15000)) return false
      if (filters.price === "150-179" && (price < 15000 || price >= 18000)) return false
      if (filters.price === "180-plus" && price < 18000) return false
    }
    return true
  })

  const salePrice = (product: GiftProduct) => product.sellIndividually === true && typeof product.salePricePaise === "number"
    ? product.salePricePaise : null
  if (filters.sort === "price-low" || filters.sort === "price-high") {
    const direction = filters.sort === "price-low" ? 1 : -1
    result.sort((a, b) => {
      const first = salePrice(a)
      const second = salePrice(b)
      if (first === null) return second === null ? 0 : 1
      if (second === null) return -1
      return (first - second) * direction
    })
  }
  if (filters.sort === "budget-low") result.sort((a, b) => a.minTier - b.minTier)
  if (filters.sort === "budget-high") result.sort((a, b) => b.minTier - a.minTier)
  if (filters.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}
