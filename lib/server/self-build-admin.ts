import type { PoolClient } from "pg"
import { transaction } from "./db"
import { getCatalogConfig } from "./catalog"

// Internal admin staging only. Do NOT import this service into a storefront
// route or payment/order path. No customer-facing price values are returned.
type CategoryKind = "group" | "catalog" | "variant" | "photo" | "notes"
type ChargeMode = "none" | "per_unit" | "once_per_category" | "option"

export type SelfBuildCategory = {
  id: string
  parentId: string | null
  label: string
  catalogCategory: string | null
  selectionKind: CategoryKind
  chargeMode: ChargeMode
  unitBudgetPaise: number | null
  displayOrder: number
  active: boolean
}
export type SelfBuildOption = {
  id: string
  categoryId: string
  label: string
  unitBudgetPaise: number
  displayOrder: number
  active: boolean
}
export type SelfBuildProductRule = {
  categoryId: string
  productId: string
  unitBudgetPaise: number | null
  active: boolean
}
export type SelfBuildConfiguration = {
  customerEnabled: false
  showItemPrices: false
  allowMultipleQuantities: boolean
  defaultCatalogItemBudgetPaise: number
  otherRequestPrompt: string
}
export type SelfBuildAdminState = {
  version: number
  config: SelfBuildConfiguration
  categories: SelfBuildCategory[]
  options: SelfBuildOption[]
  productRules: SelfBuildProductRule[]
}

type ConfigRow = {
  version: number
  customer_enabled: false
  show_item_prices: false
  allow_multiple_quantities: boolean
  default_catalog_item_budget_paise: number
  other_request_prompt: string
}
type CategoryRow = {
  id: string
  parent_id: string | null
  label: string
  catalog_category: string | null
  selection_kind: CategoryKind
  charge_mode: ChargeMode
  unit_budget_paise: number | null
  display_order: number
  active: boolean
}
type OptionRow = {
  id: string
  category_id: string
  label: string
  unit_budget_paise: number
  display_order: number
  active: boolean
}
type ProductRow = {
  category_id: string
  product_id: string
  unit_budget_paise: number | null
  active: boolean
}

export class SelfBuildAdminError extends Error {
  constructor(public readonly code: string) { super(code) }
}

function invalid(code: string): never { throw new SelfBuildAdminError(code) }
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/
const SKU = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/
function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(code)
  return value as Record<string, unknown>
}
function list(value: unknown, max: number, code: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(code)
  return value
}
function text(value: unknown, max: number, code: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(code)
  return value.trim()
}
function optionalText(value: unknown, max: number, code: string): string | null {
  if (value == null || value === "") return null
  return text(value, max, code)
}
function slug(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) invalid("INVALID_SELF_BUILD_ID")
  return value
}
function integer(value: unknown, max: number, code: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid(code)
  return value
}
function price(value: unknown, nullable = false): number | null {
  if (nullable && value == null) return null
  return integer(value, 2_147_483_647, "INVALID_SELF_BUILD_BUDGET")
}
function bool(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") invalid(code)
  return value
}
function sortOrder(value: unknown): number {
  return integer(value, 1_000_000, "INVALID_DISPLAY_ORDER", -1_000_000)
}
function unique(keys: string[], code: string) {
  if (new Set(keys).size !== keys.length) invalid(code)
}
function normalizeConfig(value: unknown): SelfBuildConfiguration {
  const data = record(value, "INVALID_SELF_BUILD_CONFIG")
  // These gates are fixed for the staging release and cannot be overridden by
  // admin PATCH. Enabling sales requires separate audited checkout changes.
  if (data.customerEnabled !== false || data.showItemPrices !== false) invalid("SELF_BUILD_NOT_READY_FOR_CUSTOMERS")
  return {
    customerEnabled: false,
    showItemPrices: false,
    allowMultipleQuantities: bool(data.allowMultipleQuantities, "INVALID_QUANTITY_SETTING"),
    defaultCatalogItemBudgetPaise: integer(data.defaultCatalogItemBudgetPaise, 2_147_483_647, "INVALID_DEFAULT_ITEM_BUDGET"),
    otherRequestPrompt: text(data.otherRequestPrompt, 500, "INVALID_OTHER_REQUEST_PROMPT")
  }
}
function normalizeCategory(value: unknown): SelfBuildCategory {
  const v = record(value, "INVALID_SELF_BUILD_CATEGORY")
  const kind = v.selectionKind
  const mode = v.chargeMode
  if (!["group", "catalog", "variant", "photo", "notes"].includes(String(kind))) invalid("INVALID_CATEGORY_KIND")
  if (!["none", "per_unit", "once_per_category", "option"].includes(String(mode))) invalid("INVALID_CATEGORY_CHARGE_MODE")
  const unit = price(v.unitBudgetPaise, true)
  const allowed = (["group","notes"].includes(String(kind)) && mode === "none" && unit === null)
    || (kind === "catalog" && mode === "per_unit")
    || (kind === "variant" && mode === "option" && unit === null)
    || (kind === "photo" && mode === "once_per_category" && unit !== null)
  if (!allowed) invalid("INVALID_CATEGORY_CHARGE_COMBINATION")
  return {
    id: slug(v.id),
    parentId: v.parentId == null ? null : slug(v.parentId),
    label: text(v.label, 100, "INVALID_CATEGORY_LABEL"),
    catalogCategory: optionalText(v.catalogCategory, 100, "INVALID_CATALOG_CATEGORY"),
    selectionKind: kind as CategoryKind,
    chargeMode: mode as ChargeMode,
    unitBudgetPaise: unit,
    displayOrder: sortOrder(v.displayOrder),
    active: bool(v.active, "INVALID_CATEGORY_ACTIVE")
  }
}
function normalizeOption(value: unknown): SelfBuildOption {
  const v = record(value, "INVALID_SELF_BUILD_OPTION")
  return {
    id: slug(v.id),
    categoryId: slug(v.categoryId),
    label: text(v.label, 100, "INVALID_OPTION_LABEL"),
    unitBudgetPaise: integer(v.unitBudgetPaise, 2_147_483_647, "INVALID_OPTION_BUDGET"),
    displayOrder: sortOrder(v.displayOrder),
    active: bool(v.active, "INVALID_OPTION_ACTIVE")
  }
}
function normalizeProductRule(value: unknown): SelfBuildProductRule {
  const v = record(value, "INVALID_SELF_BUILD_PRODUCT_RULE")
  if (typeof v.productId !== "string" || !SKU.test(v.productId)) invalid("INVALID_SELF_BUILD_PRODUCT_ID")
  return {
    categoryId: slug(v.categoryId),
    productId: v.productId,
    unitBudgetPaise: price(v.unitBudgetPaise, true),
    active: bool(v.active, "INVALID_PRODUCT_RULE_ACTIVE")
  }
}
function sortedParentsFirst(categories: SelfBuildCategory[]) {
  const byId = new Map(categories.map(c => [c.id, c]))
  const visited = new Set<string>(), visiting = new Set<string>()
  const result: SelfBuildCategory[] = []
  function visit(c: SelfBuildCategory) {
    if (visited.has(c.id)) return
    if (visiting.has(c.id)) invalid("CYCLIC_SELF_BUILD_CATEGORIES")
    visiting.add(c.id)
    if (c.parentId) {
      const parent = byId.get(c.parentId)
      if (!parent || parent.selectionKind !== "group") invalid("INVALID_CATEGORY_PARENT")
      visit(parent)
    }
    visiting.delete(c.id)
    visited.add(c.id)
    result.push(c)
  }
  categories.forEach(visit)
  return result
}
export function normalizeSelfBuildAdminInput(value: unknown, realProductIds?: ReadonlySet<string>, realCategories?: ReadonlySet<string>) {
  const raw = record(value, "INVALID_SELF_BUILD_PAYLOAD")
  const version = integer(raw.version, 2_147_483_647, "INVALID_SELF_BUILD_VERSION", 1)
  const config = normalizeConfig(raw.config)
  const categories = list(raw.categories, 200, "INVALID_SELF_BUILD_CATEGORIES").map(normalizeCategory)
  const options = list(raw.options, 1200, "INVALID_SELF_BUILD_OPTIONS").map(normalizeOption)
  const productRules = list(raw.productRules, 2000, "INVALID_SELF_BUILD_PRODUCT_RULES").map(normalizeProductRule)
  unique(categories.map(c => c.id), "DUPLICATE_SELF_BUILD_CATEGORY")
  unique(options.map(o => o.id), "DUPLICATE_SELF_BUILD_OPTION")
  unique(productRules.map(r => r.categoryId + ":" + r.productId), "DUPLICATE_SELF_BUILD_PRODUCT_RULE")
  const byId = new Map(categories.map(c => [c.id, c]))
  const ordered = sortedParentsFirst(categories)
  for (const category of categories) {
    if (category.catalogCategory && realCategories && !realCategories.has(category.catalogCategory)) invalid("UNKNOWN_CATALOG_CATEGORY")
  }
  for (const option of options) {
    if (byId.get(option.categoryId)?.selectionKind !== "variant") invalid("OPTION_CATEGORY_NOT_VARIANT")
  }
  for (const rule of productRules) {
    if (byId.get(rule.categoryId)?.selectionKind !== "catalog") invalid("PRODUCT_RULE_CATEGORY_NOT_CATALOG")
    if (realProductIds && !realProductIds.has(rule.productId)) invalid("UNKNOWN_CATALOG_PRODUCT")
  }
  return { version, config, categories: ordered, options, productRules }
}

async function readState(client: PoolClient): Promise<SelfBuildAdminState> {
  const settings = await client.query<ConfigRow>("SELECT * FROM self_build_configuration WHERE id = 'primary'")
  const current = settings.rows[0]
  if (!current) throw new Error("SELF_BUILD_MIGRATION_NOT_APPLIED")
  const categories = await client.query<CategoryRow>("SELECT * FROM self_build_categories ORDER BY display_order, id")
  const options = await client.query<OptionRow>("SELECT * FROM self_build_options ORDER BY display_order, id")
  const rules = await client.query<ProductRow>("SELECT * FROM self_build_catalog_product_rules ORDER BY category_id, product_id")
  return {
    version: current.version,
    config: {
      customerEnabled: false,
      showItemPrices: false,
      allowMultipleQuantities: current.allow_multiple_quantities,
      defaultCatalogItemBudgetPaise: current.default_catalog_item_budget_paise,
      otherRequestPrompt: current.other_request_prompt
    },
    categories: categories.rows.map(c => ({
      id: c.id, parentId: c.parent_id, label: c.label, catalogCategory: c.catalog_category,
      selectionKind: c.selection_kind, chargeMode: c.charge_mode,
      unitBudgetPaise: c.unit_budget_paise, displayOrder: c.display_order, active: c.active
    })),
    options: options.rows.map(o => ({
      id: o.id, categoryId: o.category_id, label: o.label, unitBudgetPaise: o.unit_budget_paise,
      displayOrder: o.display_order, active: o.active
    })),
    productRules: rules.rows.map(r => ({
      categoryId: r.category_id, productId: r.product_id, unitBudgetPaise: r.unit_budget_paise, active: r.active
    }))
  }
}
export async function getSelfBuildAdminState() {
  return transaction(async client => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    return readState(client)
  })
}

export async function saveSelfBuildAdminState(value: unknown) {
  // Checked against the current DB-backed catalogue; never infer bangle
  // membership from the textual product name.
  const catalog = await getCatalogConfig()
  const knownProducts = new Set(catalog.catalog.products.filter(p => p.active !== false).map(p => p.id))
  const knownCategories = new Set(catalog.catalog.products.filter(p => p.active !== false).map(p => p.category))
  const data = normalizeSelfBuildAdminInput(value, knownProducts, knownCategories)
  return transaction(async client => {
    const locked = await client.query<{ version: number }>(
      "SELECT version FROM self_build_configuration WHERE id='primary' FOR UPDATE"
    )
    if (!locked.rows[0]) throw new Error("SELF_BUILD_MIGRATION_NOT_APPLIED")
    if (locked.rows[0].version !== data.version) invalid("STALE_SELF_BUILD_CONFIGURATION")
    // Atomic replacement ensures an admin cannot publish half a price list.
    // No public-facing checkout uses these rows in this staging release.
    await client.query("DELETE FROM self_build_catalog_product_rules")
    await client.query("DELETE FROM self_build_options")
    await client.query("DELETE FROM self_build_categories")
    for (const c of data.categories) {
      await client.query(
        `INSERT INTO self_build_categories (id,parent_id,label,catalog_category,selection_kind,charge_mode,unit_budget_paise,display_order,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [c.id,c.parentId,c.label,c.catalogCategory,c.selectionKind,c.chargeMode,c.unitBudgetPaise,c.displayOrder,c.active]
      )
    }
    for (const o of data.options) {
      await client.query(
        "INSERT INTO self_build_options (id,category_id,label,unit_budget_paise,display_order,active) VALUES ($1,$2,$3,$4,$5,$6)",
        [o.id,o.categoryId,o.label,o.unitBudgetPaise,o.displayOrder,o.active]
      )
    }
    for (const r of data.productRules) {
      await client.query(
        "INSERT INTO self_build_catalog_product_rules (category_id,product_id,unit_budget_paise,active) VALUES ($1,$2,$3,$4)",
        [r.categoryId,r.productId,r.unitBudgetPaise,r.active]
      )
    }
    await client.query(
      `UPDATE self_build_configuration SET version=version+1,customer_enabled=false,show_item_prices=false,
         allow_multiple_quantities=$1,default_catalog_item_budget_paise=$2,other_request_prompt=$3,updated_at=now()
         WHERE id='primary'`,
      [data.config.allowMultipleQuantities,data.config.defaultCatalogItemBudgetPaise,data.config.otherRequestPrompt]
    )
    return readState(client)
  })
}
