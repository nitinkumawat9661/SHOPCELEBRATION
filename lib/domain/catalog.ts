import rawCatalog from "../../content/catalog.json"
import { paymentConfig } from "../../config/payment"

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

export type GiftProduct = {
  id: string
  name: string
  category: string
  minTier: number
  points: number
  note: string
  icon?: string
  imageUrl?: string
  active?: boolean
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
    maximumFractionDigits: 0
  }).format(value)
}
