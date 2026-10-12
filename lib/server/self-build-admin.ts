import type { PoolClient } from "pg"
import { transaction } from "./db"

// Internal/admin-only category-first hamper staging. This module neither
// fetches retail SKUs nor implements a checkout, payment or stock reservation.
// The customer-facing mode and private amount visibility remain hard-disabled.
type CategoryKind = "group" | "category" | "variant" | "photo" | "notes"
type ChargeMode = "none" | "per_unit" | "once_per_category" | "option"

export type SelfBuildCategory = {
  id: string
  parentId: string | null
  label: string
  selectionKind: CategoryKind
  chargeMode: ChargeMode
  unitBudgetPaise: number | null
  displayOrder: number
  active: boolean
  availabilityConfirmed: boolean
  availableUnits: number | null
}
export type SelfBuildOption = {
  id: string
  categoryId: string
  label: string
  unitBudgetPaise: number
  displayOrder: number
  active: boolean
  availabilityConfirmed: boolean
  availableUnits: number | null
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
}

type ConfigRow = {
  version: number
  allow_multiple_quantities: boolean
  default_catalog_item_budget_paise: number
  other_request_prompt: string
}
type CategoryRow = {
  id: string
  parent_id: string | null
  label: string
  selection_kind: CategoryKind
  charge_mode: ChargeMode
  unit_budget_paise: number | null
  display_order: number
  active: boolean
  availability_confirmed: boolean
  available_units: number | null
}
type OptionRow = {
  id: string
  category_id: string
  label: string
  unit_budget_paise: number
  display_order: number
  active: boolean
  availability_confirmed: boolean
  available_units: number | null
}

export class SelfBuildAdminError extends Error {
  constructor(public readonly code: string) { super(code) }
}

function invalid(code: string): never { throw new SelfBuildAdminError(code) }
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/
function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(code)
  return value as Record<string, unknown>
}
function list(value: unknown, max: number, code: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(code)
  return value
}
function cleanText(value: unknown, max: number, code: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(code)
  return value.trim()
}
function slug(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) invalid("INVALID_SELF_BUILD_ID")
  return value
}
function integer(value: unknown, max: number, code: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid(code)
  return value
}
function amount(value: unknown, nullable = false): number | null {
  if (nullable && value == null) return null
  return integer(value, 2_147_483_647, "INVALID_SELF_BUILD_BUDGET")
}
function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") invalid(code)
  return value
}
function sortOrder(value: unknown): number {
  return integer(value, 1_000_000, "INVALID_DISPLAY_ORDER", -1_000_000)
}
function capacity(v: Record<string, unknown>) {
  const confirmed = boolean(v.availabilityConfirmed, "INVALID_AVAILABILITY_CONFIRMATION")
  const count = confirmed ? integer(v.availableUnits, 1_000_000, "INVALID_AVAILABLE_UNITS") : null
  if (!confirmed && v.availableUnits != null) invalid("UNCONFIRMED_CAPACITY_MUST_BE_EMPTY")
  return { availabilityConfirmed: confirmed, availableUnits: count }
}
function unique(ids: string[], code: string) {
  if (new Set(ids).size !== ids.length) invalid(code)
}
function normalizeConfig(value: unknown): SelfBuildConfiguration {
  const v = record(value, "INVALID_SELF_BUILD_CONFIG")
  // Even an authenticated administrator cannot prematurely activate buyers or
  // expose internal consumption amounts via this staging endpoint.
  if (v.customerEnabled !== false || v.showItemPrices !== false) invalid("SELF_BUILD_NOT_READY_FOR_CUSTOMERS")
  return {
    customerEnabled: false,
    showItemPrices: false,
    allowMultipleQuantities: boolean(v.allowMultipleQuantities, "INVALID_QUANTITY_SETTING"),
    defaultCatalogItemBudgetPaise: integer(v.defaultCatalogItemBudgetPaise, 2_147_483_647, "INVALID_DEFAULT_ITEM_BUDGET"),
    otherRequestPrompt: cleanText(v.otherRequestPrompt, 500, "INVALID_OTHER_REQUEST_PROMPT")
  }
}
function normalizeCategory(value: unknown): SelfBuildCategory {
  const v = record(value, "INVALID_SELF_BUILD_CATEGORY")
  // This is CATEGORY ONLY: deliberately reject all old product/SKU links.
  if ("catalogCategory" in v || "productId" in v || "productIds" in v) invalid("SKU_MAPPING_NOT_SUPPORTED")
  const kind = v.selectionKind
  const mode = v.chargeMode
  if (!["group", "category", "variant", "photo", "notes"].includes(String(kind))) invalid("INVALID_CATEGORY_KIND")
  if (!["none", "per_unit", "once_per_category", "option"].includes(String(mode))) invalid("INVALID_CATEGORY_CHARGE_MODE")
  const unit = amount(v.unitBudgetPaise, true)
  const allowed = (["group", "notes"].includes(String(kind)) && mode === "none" && unit === null)
    || (kind === "category" && mode === "per_unit" && unit !== null)
    || (kind === "variant" && mode === "option" && unit === null)
    || (kind === "photo" && (mode === "per_unit" || mode === "once_per_category") && unit !== null)
  if (!allowed) invalid("INVALID_CATEGORY_CHARGE_COMBINATION")
  return {
    id: slug(v.id),
    parentId: v.parentId == null ? null : slug(v.parentId),
    label: cleanText(v.label, 100, "INVALID_CATEGORY_LABEL"),
    selectionKind: kind as CategoryKind,
    chargeMode: mode as ChargeMode,
    unitBudgetPaise: unit,
    displayOrder: sortOrder(v.displayOrder),
    active: boolean(v.active, "INVALID_CATEGORY_ACTIVE"),
    ...capacity(v)
  }
}
function normalizeOption(value: unknown): SelfBuildOption {
  const v = record(value, "INVALID_SELF_BUILD_OPTION")
  return {
    id: slug(v.id),
    categoryId: slug(v.categoryId),
    label: cleanText(v.label, 100, "INVALID_OPTION_LABEL"),
    unitBudgetPaise: integer(v.unitBudgetPaise, 2_147_483_647, "INVALID_OPTION_BUDGET"),
    displayOrder: sortOrder(v.displayOrder),
    active: boolean(v.active, "INVALID_OPTION_ACTIVE"),
    ...capacity(v)
  }
}
function parentsFirst(categories: SelfBuildCategory[]) {
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

export function normalizeSelfBuildAdminInput(value: unknown) {
  const raw = record(value, "INVALID_SELF_BUILD_PAYLOAD")
  if ("productRules" in raw || "catalogProducts" in raw) invalid("SKU_MAPPING_NOT_SUPPORTED")
  const version = integer(raw.version, 2_147_483_647, "INVALID_SELF_BUILD_VERSION", 1)
  const config = normalizeConfig(raw.config)
  const categories = list(raw.categories, 200, "INVALID_SELF_BUILD_CATEGORIES").map(normalizeCategory)
  const options = list(raw.options, 1200, "INVALID_SELF_BUILD_OPTIONS").map(normalizeOption)
  unique(categories.map(c => c.id), "DUPLICATE_SELF_BUILD_CATEGORY")
  unique(options.map(o => o.id), "DUPLICATE_SELF_BUILD_OPTION")
  const byId = new Map(categories.map(c => [c.id, c]))
  const ordered = parentsFirst(categories)
  for (const option of options) {
    if (byId.get(option.categoryId)?.selectionKind !== "variant") invalid("OPTION_CATEGORY_NOT_VARIANT")
  }
  return { version, config, categories: ordered, options }
}

async function readState(client: PoolClient): Promise<SelfBuildAdminState> {
  const result = await client.query<ConfigRow>("SELECT * FROM self_build_configuration WHERE id='primary'")
  const row = result.rows[0]
  if (!row) throw new Error("SELF_BUILD_MIGRATION_NOT_APPLIED")
  const categories = await client.query<CategoryRow>("SELECT * FROM self_build_categories ORDER BY display_order, id")
  const options = await client.query<OptionRow>("SELECT * FROM self_build_options ORDER BY display_order, id")
  return {
    version: row.version,
    config: {
      customerEnabled: false,
      showItemPrices: false,
      allowMultipleQuantities: row.allow_multiple_quantities,
      defaultCatalogItemBudgetPaise: row.default_catalog_item_budget_paise,
      otherRequestPrompt: row.other_request_prompt
    },
    categories: categories.rows.map(c => ({
      id: c.id, parentId: c.parent_id, label: c.label,
      selectionKind: c.selection_kind, chargeMode: c.charge_mode,
      unitBudgetPaise: c.unit_budget_paise, displayOrder: c.display_order, active: c.active,
      availabilityConfirmed: c.availability_confirmed, availableUnits: c.available_units
    })),
    options: options.rows.map(o => ({
      id: o.id, categoryId: o.category_id, label: o.label,
      unitBudgetPaise: o.unit_budget_paise, displayOrder: o.display_order, active: o.active,
      availabilityConfirmed: o.availability_confirmed, availableUnits: o.available_units
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
  const data = normalizeSelfBuildAdminInput(value)
  return transaction(async client => {
    const locked = await client.query<{ version: number }>(
      "SELECT version FROM self_build_configuration WHERE id='primary' FOR UPDATE"
    )
    if (!locked.rows[0]) throw new Error("SELF_BUILD_MIGRATION_NOT_APPLIED")
    if (locked.rows[0].version !== data.version) invalid("STALE_SELF_BUILD_CONFIGURATION")
    // All labels, amounts, category types, option sizes and display order are
    // DB-driven. No retail catalogue, SKU or individual-item images involved.
    await client.query("DELETE FROM self_build_options")
    await client.query("DELETE FROM self_build_categories")
    for (const c of data.categories) {
      await client.query(
        `INSERT INTO self_build_categories
          (id,parent_id,label,selection_kind,charge_mode,unit_budget_paise,display_order,active,availability_confirmed,available_units)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [c.id,c.parentId,c.label,c.selectionKind,c.chargeMode,c.unitBudgetPaise,c.displayOrder,c.active,c.availabilityConfirmed,c.availableUnits]
      )
    }
    for (const o of data.options) {
      await client.query(
        `INSERT INTO self_build_options
          (id,category_id,label,unit_budget_paise,display_order,active,availability_confirmed,available_units)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [o.id,o.categoryId,o.label,o.unitBudgetPaise,o.displayOrder,o.active,o.availabilityConfirmed,o.availableUnits]
      )
    }
    await client.query(
      `UPDATE self_build_configuration SET version=version+1,
         customer_enabled=false,show_item_prices=false,
         allow_multiple_quantities=$1,default_catalog_item_budget_paise=$2,
         other_request_prompt=$3,updated_at=now()
         WHERE id='primary'`,
      [data.config.allowMultipleQuantities,data.config.defaultCatalogItemBudgetPaise,data.config.otherRequestPrompt]
    )
    return readState(client)
  })
}
