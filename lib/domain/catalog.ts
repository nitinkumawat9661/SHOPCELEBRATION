import rawCatalog from "../../content/catalog.json"
import { paymentConfig } from "../../config/payment"
import { validation } from "../../config/validation"

export type Tier = {
  id: string
  price: number
  name: string
  size: string
  maxChoices: number
  pointBudget: number
  label?: string
  active?: boolean
}

export type RetailDeclarations = {
  genericName?: string
  netQuantity?: string
  mrpPaise?: number
  manufacturerOrPackerName?: string
  manufacturerOrPackerAddress?: string
  importerName?: string
  importerAddress?: string
  countryOfOrigin?: string
  consumerCare?: string
  bestBefore?: string
  unitSalePrice?: string
  warrantyOrGuarantee?: string
}

export type ProductImage = {
  url: string
  alt?: string
  /** Original source for this exact photograph; never another product's photo. */
  fallbackUrl?: string
}

export type GiftProduct = {
  id: string
  name: string
  category: string
  minTier: number
  points: number
  note: string
  description?: string
  highlights?: string[]
  badge?: string
  /** Server-derived, transient badge evidence; never part of an admin catalog save. */
  badgeSignals?: {
    bestsellerOrders?: number
    firstPublishedAt?: string
    firstRevisionVersion?: number
  }
  icon?: string
  imageUrl?: string
  images?: ProductImage[]
  active?: boolean
  sellIndividually?: boolean
  salePricePaise?: number
  prepackagedRetail?: boolean
  retail?: RetailDeclarations
  stockAvailable?: number
}

export function salePriceFromRupees(value: string): number | undefined {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined
  const [rupees, paise = ""] = value.split(".")
  const amount = Number(rupees) * 100 + Number(paise.padEnd(2, "0"))
  return Number.isSafeInteger(amount) && amount >= 100 && amount <= Math.min(validation.catalog.maxPrice * 100, 2147483647) ? amount : undefined
}

export function productImages(product: GiftProduct): ProductImage[] {
  const seen = new Set<string>()
  const images = (product.images || [])
    .filter((item) => item && typeof item.url === "string" && item.url.trim())
    .map((item) => ({
      url: item.url.trim(),
      alt: item.alt?.trim() || undefined,
      fallbackUrl: item.fallbackUrl?.trim() || undefined
    }))
    .filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
  if (product.imageUrl && !seen.has(product.imageUrl)) images.unshift({ url: product.imageUrl, alt: product.name, fallbackUrl: undefined })
  return images
}

export function primaryProductImage(product: GiftProduct) {
  return productImages(product)[0]
}

/**
 * Rehosted images carry deterministic R2 thumb / main / zoom variants.
 * For all other catalog URLs, preserve the original URL unchanged.
 */
export function catalogImageVariant(url: string, variant: "thumb" | "main" | "zoom") {
  if (!url.startsWith("/api/catalog/image?key=")) return url
  const params = new URLSearchParams(url.split("?")[1] || "")
  const key = params.get("key") || ""
  if (!/^catalog\/rehost\/meesho\/[a-f0-9]{64}\/main\.webp$/.test(key)) return url
  params.set("key", key.replace(/\/main\.webp$/, `/${variant}.webp`))
  return `/api/catalog/image?${params.toString()}`
}

export function catalogSpriteImage(url: string) {
  const match = url.match(/^(.*)\?tile=([0-4])$/)
  if (!match) return null
  const tile = Number(match[2])
  return {
    url: match[1],
    tile,
    backgroundPosition: `${tile * 25}% center`
  }
}

export function productDiscountPercent(product: GiftProduct) {
  const sale = product.salePricePaise
  const mrp = product.retail?.mrpPaise
  if (typeof sale !== "number" || typeof mrp !== "number" ||
      !Number.isSafeInteger(sale) || !Number.isSafeInteger(mrp) ||
      sale <= 0 || mrp <= sale) return null
  return Math.round((mrp - sale) * 100 / mrp)
}

export function isIndividualListing(product: GiftProduct) {
  const price = product.salePricePaise
  return product.active !== false && product.sellIndividually === true && typeof price === "number" && Number.isSafeInteger(price) && price >= 100 && price <= Math.min(validation.catalog.maxPrice * 100, 2147483647)
}

export function isIndividuallySellable(product: GiftProduct) {
  return isIndividualListing(product) && (product.stockAvailable == null || product.stockAvailable > 0)
}

export type CategoryOption = { id: string; label: string }
export type SelectionRuleReason = "minTier" | "maxChoices" | "pointBudget" | null
export type SelectionRule = { ok: boolean; reason: SelectionRuleReason; value?: number }

export type CatalogConfig = {
  settings: {
    defaultTierId: string
    defaultOccasion: string
    allCategory: CategoryOption
  }
  tiers: Tier[]
  products: GiftProduct[]
  occasions: string[]
}

export const defaultCatalog = rawCatalog as CatalogConfig

export function visibleTiers(catalog: CatalogConfig) {
  return catalog.tiers.filter((item) => item.active !== false)
}

export function visibleProducts(catalog: CatalogConfig) {
  return catalog.products.filter((item) => item.active !== false)
}

export function categoriesForCatalog(catalog: CatalogConfig): CategoryOption[] {
  return [
    catalog.settings.allCategory,
    ...Array.from(new Set(visibleProducts(catalog).map((item) => item.category))).map((label) => ({ id: label, label }))
  ]
}

export function tierById(catalog: CatalogConfig, id: string): Tier | undefined
export function tierById(id: string): Tier | undefined
export function tierById(catalogOrId: CatalogConfig | string, id?: string) {
  const catalog = typeof catalogOrId === "string" ? defaultCatalog : catalogOrId
  const targetId = typeof catalogOrId === "string" ? catalogOrId : (id || "")
  return visibleTiers(catalog).find((item) => item.id === targetId)
}

export function productById(catalog: CatalogConfig, id: string): GiftProduct | undefined
export function productById(id: string): GiftProduct | undefined
export function productById(catalogOrId: CatalogConfig | string, id?: string) {
  const catalog = typeof catalogOrId === "string" ? defaultCatalog : catalogOrId
  const targetId = typeof catalogOrId === "string" ? catalogOrId : (id || "")
  return visibleProducts(catalog).find((item) => item.id === targetId)
}

export function selectedPoints(catalog: CatalogConfig, ids: string[]) {
  return ids.reduce((total, id) => total + (productById(catalog, id)?.points ?? 0), 0)
}

export function canSelectProduct(catalog: CatalogConfig, tier: Tier, selectedIds: string[], product: GiftProduct): SelectionRule {
  if (product.minTier > tier.price) return { ok: false, reason: "minTier", value: product.minTier }
  if (selectedIds.includes(product.id)) return { ok: true, reason: null }
  if (selectedIds.length >= tier.maxChoices) return { ok: false, reason: "maxChoices", value: tier.maxChoices }
  if (selectedPoints(catalog, selectedIds) + product.points > tier.pointBudget) return { ok: false, reason: "pointBudget" }
  return { ok: true, reason: null }
}

export function normalizeSelection(catalog: CatalogConfig, tier: Tier, ids: string[]) {
  const kept: string[] = []
  for (const id of ids) {
    const product = productById(catalog, id)
    if (!product) continue
    if (canSelectProduct(catalog, tier, kept, product).ok) kept.push(id)
  }
  return kept
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat(paymentConfig.locale, {
    style: "currency",
    currency: paymentConfig.currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}
