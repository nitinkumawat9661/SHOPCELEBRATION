import { createHash } from "node:crypto"
import { validation } from "../../config/validation"
import { defaultCatalog, type CatalogConfig, type GiftProduct, type Tier } from "../domain/catalog"
import { hasUnsafeText, sanitizeText } from "../validation/text"
import { query, transaction } from "./db"
import { applyInventoryAvailability, inventoryAvailabilityForCatalog } from "./inventory"

type CatalogRow = { payload: CatalogConfig; version: number }
type DraftRow = { payload: CatalogConfig; base_version: number; updated_at: Date }
type RevisionRow = { id: string; version: number; payload: CatalogConfig; created_at: Date }

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export class CatalogValidationError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

function cleanRequired(value: unknown, max: number, code: string) {
  if (hasUnsafeText(value)) throw new CatalogValidationError("UNSAFE_TEXT")
  const text = sanitizeText(value, max)
  if (!text) throw new CatalogValidationError(code)
  return text
}

function cleanOptional(value: unknown, max: number) {
  if (hasUnsafeText(value)) throw new CatalogValidationError("UNSAFE_TEXT")
  return sanitizeText(value, max)
}

function cleanId(value: unknown) {
  const id = cleanRequired(value, validation.catalog.idMax, "INVALID_ID").toLowerCase()
  if (!ID_PATTERN.test(id)) throw new CatalogValidationError("INVALID_ID")
  return id
}

function integer(value: unknown, min: number, max: number, code: string) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new CatalogValidationError(code)
  return number
}

function imageUrl(value: unknown) {
  const url = cleanOptional(value, validation.catalog.imageUrlMax)
  if (!url) return ""
  if (url.startsWith("/api/catalog/image?key=")) return url
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") throw new Error("protocol")
    return parsed.toString()
  } catch {
    throw new CatalogValidationError("INVALID_IMAGE_URL")
  }
}

function sameImageMeeshoFallback(imageUrl: string, value: unknown) {
  if (value === undefined || value === null || value === "") return undefined
  const fallback = imageUrlExternal(value)
  if (!fallback) throw new CatalogValidationError("INVALID_IMAGE_FALLBACK")
  let parsed: URL
  try { parsed = new URL(fallback) } catch { throw new CatalogValidationError("INVALID_IMAGE_FALLBACK") }
  if (parsed.protocol !== "https:" || parsed.hostname !== "upload.meeshosupplyassets.com" || parsed.port || parsed.username || parsed.password) {
    throw new CatalogValidationError("INVALID_IMAGE_FALLBACK")
  }
  // Prove same image URL: stored R2 key is the hash of this exact original URL.
  const main = new URL(imageUrl, "https://shopcelebration.in")
  const key = main.pathname === "/api/catalog/image" ? main.searchParams.get("key") || "" : ""
  const digest = createHash("sha256").update(fallback).digest("hex")
  if (key !== `catalog/rehost/meesho/${digest}/main.webp`) {
    throw new CatalogValidationError("IMAGE_FALLBACK_SOURCE_MISMATCH")
  }
  return fallback
}

function imageUrlExternal(value: unknown) {
  const valueText = cleanOptional(value, validation.catalog.imageUrlMax)
  if (!valueText) return ""
  try {
    const u = new URL(valueText)
    if (u.protocol !== "https:") throw new Error("protocol")
    return u.toString()
  } catch { throw new CatalogValidationError("INVALID_IMAGE_FALLBACK") }
}

function normalizeProductImages(input: unknown, fallbackImageUrl: string, productName: string) {
  const raw = Array.isArray(input) ? input : []
  if (raw.length > validation.catalog.maxImages) throw new CatalogValidationError("TOO_MANY_PRODUCT_IMAGES")
  const seen = new Set<string>()
  const images = raw.map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>
    const url = imageUrl(item.url)
    if (!url) throw new CatalogValidationError("INVALID_IMAGE_URL")
    if (seen.has(url)) throw new CatalogValidationError("DUPLICATE_PRODUCT_IMAGE")
    seen.add(url)
    const fallbackUrl = sameImageMeeshoFallback(url, item.fallbackUrl)
    return {
      url,
      alt: cleanOptional(item.alt, validation.catalog.nameMax) || productName,
      ...(fallbackUrl ? { fallbackUrl } : {})
    }
  })
  if (!images.length && fallbackImageUrl) images.push({ url: fallbackImageUrl, alt: productName })
  return images.length ? images : undefined
}

function normalizeHighlights(input: unknown) {
  if (input === undefined || input === null) return undefined
  if (!Array.isArray(input) || input.length > validation.catalog.maxHighlights) throw new CatalogValidationError("INVALID_PRODUCT_HIGHLIGHTS")
  const values = input.map((value) => cleanRequired(value, validation.catalog.highlightMax, "INVALID_PRODUCT_HIGHLIGHT"))
  return values.length ? values : undefined
}

function normalizeTier(input: unknown): Tier {
  const item = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  return {
    id: cleanId(item.id),
    price: integer(item.price, 1, validation.catalog.maxPrice, "INVALID_TIER_PRICE"),
    name: cleanRequired(item.name, validation.catalog.nameMax, "INVALID_TIER_NAME"),
    size: cleanRequired(item.size, validation.catalog.sizeMax, "INVALID_TIER_SIZE"),
    maxChoices: integer(item.maxChoices, 1, validation.catalog.maxChoices, "INVALID_MAX_CHOICES"),
    pointBudget: integer(item.pointBudget, 1, validation.catalog.maxPoints, "INVALID_POINT_BUDGET"),
    label: cleanOptional(item.label, validation.catalog.labelMax) || undefined,
    active: item.active !== false
  }
}

function normalizeRetailDeclarations(input: unknown, required: boolean) {
  const raw = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>
  const mrpPaise = raw.mrpPaise === undefined || raw.mrpPaise === null || raw.mrpPaise === ""
    ? undefined
    : integer(raw.mrpPaise, 1, Math.min(validation.catalog.maxPrice * 100, 2147483647), "INVALID_MRP")
  const retail = {
    genericName: cleanOptional(raw.genericName, validation.catalog.nameMax) || undefined,
    netQuantity: cleanOptional(raw.netQuantity, validation.catalog.sizeMax) || undefined,
    mrpPaise,
    manufacturerOrPackerName: cleanOptional(raw.manufacturerOrPackerName, validation.catalog.nameMax) || undefined,
    manufacturerOrPackerAddress: cleanOptional(raw.manufacturerOrPackerAddress, validation.address.max) || undefined,
    importerName: cleanOptional(raw.importerName, validation.catalog.nameMax) || undefined,
    importerAddress: cleanOptional(raw.importerAddress, validation.address.max) || undefined,
    countryOfOrigin: cleanOptional(raw.countryOfOrigin, validation.catalog.categoryMax) || undefined,
    consumerCare: cleanOptional(raw.consumerCare, validation.catalog.noteMax) || undefined,
    bestBefore: cleanOptional(raw.bestBefore, validation.catalog.labelMax) || undefined,
    unitSalePrice: cleanOptional(raw.unitSalePrice, validation.catalog.labelMax) || undefined,
    warrantyOrGuarantee: cleanOptional(raw.warrantyOrGuarantee, validation.catalog.noteMax) || undefined
  }

  if (!required && !Object.values(retail).some((value) => value !== undefined)) return undefined
  if (required && (!retail.genericName || !retail.netQuantity || !retail.mrpPaise || !retail.manufacturerOrPackerName || !retail.manufacturerOrPackerAddress || !retail.countryOfOrigin || !retail.consumerCare)) {
    throw new CatalogValidationError("RETAIL_DECLARATIONS_REQUIRED")
  }
  const origin = retail.countryOfOrigin?.trim().toLowerCase()
  if (required && origin && origin !== "india" && (!retail.importerName || !retail.importerAddress)) {
    throw new CatalogValidationError("IMPORTER_DECLARATIONS_REQUIRED")
  }
  return retail
}

function normalizeProduct(input: unknown): GiftProduct {
  const item = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  if (item.sellIndividually !== undefined && typeof item.sellIndividually !== "boolean") throw new CatalogValidationError("INVALID_INDIVIDUAL_SALE_SETTING")
  const sellIndividually = item.sellIndividually === true
  if (item.prepackagedRetail !== undefined && typeof item.prepackagedRetail !== "boolean") throw new CatalogValidationError("INVALID_RETAIL_DECLARATION_SETTING")
  const prepackagedRetail = item.prepackagedRetail === true
  if (item.salePricePaise != null && typeof item.salePricePaise !== "number") throw new CatalogValidationError("INVALID_SALE_PRICE")
  const salePricePaise = item.salePricePaise === undefined || item.salePricePaise === null
    ? undefined
    : integer(item.salePricePaise, 100, Math.min(validation.catalog.maxPrice * 100, 2147483647), "INVALID_SALE_PRICE")
  if (sellIndividually && salePricePaise === undefined) throw new CatalogValidationError("SALE_PRICE_REQUIRED")
  const retail = normalizeRetailDeclarations(item.retail, prepackagedRetail)
  if (sellIndividually && retail?.mrpPaise && salePricePaise !== undefined && salePricePaise > retail.mrpPaise) {
    throw new CatalogValidationError("SALE_PRICE_ABOVE_MRP")
  }
  const name = cleanRequired(item.name, validation.catalog.nameMax, "INVALID_PRODUCT_NAME")
  const legacyImageUrl = imageUrl(item.imageUrl)
  const images = normalizeProductImages(item.images, legacyImageUrl, name)
  return {
    id: cleanId(item.id),
    name,
    category: cleanRequired(item.category, validation.catalog.categoryMax, "INVALID_CATEGORY"),
    minTier: integer(item.minTier, 0, validation.catalog.maxPrice, "INVALID_MIN_TIER"),
    points: integer(item.points, 1, validation.catalog.maxPoints, "INVALID_PRODUCT_POINTS"),
    note: cleanOptional(item.note, validation.catalog.noteMax),
    description: cleanOptional(item.description, validation.catalog.descriptionMax) || undefined,
    highlights: normalizeHighlights(item.highlights),
    badge: cleanOptional(item.badge, validation.catalog.badgeMax) || undefined,
    icon: cleanOptional(item.icon, 16) || undefined,
    imageUrl: images?.[0]?.url || legacyImageUrl || undefined,
    images,
    active: item.active !== false,
    sellIndividually,
    salePricePaise,
    prepackagedRetail,
    retail
  }
}

function unique(values: string[], code: string) {
  if (new Set(values).size !== values.length) throw new CatalogValidationError(code)
}

export function normalizeCatalogConfig(input: unknown): CatalogConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const rawTiers = Array.isArray(raw.tiers) ? raw.tiers : []
  const rawProducts = Array.isArray(raw.products) ? raw.products : []
  const rawOccasions = Array.isArray(raw.occasions) ? raw.occasions : []
  const rawSettings = (raw.settings && typeof raw.settings === "object" ? raw.settings : {}) as Record<string, unknown>
  const rawAllCategory = (rawSettings.allCategory && typeof rawSettings.allCategory === "object" ? rawSettings.allCategory : {}) as Record<string, unknown>

  if (!rawTiers.length || rawTiers.length > validation.catalog.maxTiers) throw new CatalogValidationError("INVALID_TIER_COUNT")
  if (rawProducts.length > validation.catalog.maxProducts) throw new CatalogValidationError("INVALID_PRODUCT_COUNT")
  if (!rawOccasions.length || rawOccasions.length > validation.catalog.maxOccasions) throw new CatalogValidationError("INVALID_OCCASION_COUNT")

  const tiers = rawTiers.map(normalizeTier)
  const products = rawProducts.map(normalizeProduct)
  const occasions = rawOccasions.map((value) => cleanRequired(value, validation.occasionMax, "INVALID_OCCASION"))
  unique(tiers.map((item) => item.id), "DUPLICATE_TIER_ID")
  unique(products.map((item) => item.id), "DUPLICATE_PRODUCT_ID")
  unique(occasions.map((item) => item.toLowerCase()), "DUPLICATE_OCCASION")

  const defaultTierId = cleanId(rawSettings.defaultTierId)
  const defaultOccasion = cleanRequired(rawSettings.defaultOccasion, validation.occasionMax, "INVALID_DEFAULT_OCCASION")
  if (!tiers.some((item) => item.id === defaultTierId && item.active !== false)) throw new CatalogValidationError("INVALID_DEFAULT_TIER")
  if (!occasions.includes(defaultOccasion)) throw new CatalogValidationError("INVALID_DEFAULT_OCCASION")

  return {
    settings: {
      defaultTierId,
      defaultOccasion,
      allCategory: {
        id: cleanId(rawAllCategory.id || "all"),
        label: cleanRequired(rawAllCategory.label || "All", validation.catalog.categoryMax, "INVALID_ALL_CATEGORY")
      }
    },
    tiers,
    products,
    occasions
  }
}

async function withInventory(catalog: CatalogConfig) {
  const availability = await inventoryAvailabilityForCatalog(catalog)
  return applyInventoryAvailability(catalog, availability)
}

async function recordRevision(version: number, catalog: CatalogConfig) {
  await query(`INSERT INTO catalog_revisions (version, payload) VALUES ($1, $2::jsonb)`, [version, JSON.stringify(catalog)])
}

export async function getCatalogConfig() {
  const result = await query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary'")
  const row = result.rows[0]
  if (row) {
    const catalog = normalizeCatalogConfig(row.payload)
    return { catalog: await withInventory(catalog), version: row.version }
  }

  const seed = normalizeCatalogConfig(defaultCatalog)
  const inserted = await query<CatalogRow>(
    `INSERT INTO catalog_config (id, payload, version, updated_at)
     VALUES ('primary', $1::jsonb, 1, now())
     ON CONFLICT (id) DO NOTHING
     RETURNING payload, version`,
    [JSON.stringify(seed)]
  )
  if (inserted.rows[0]) {
    await recordRevision(inserted.rows[0].version, seed)
    return { catalog: await withInventory(seed), version: inserted.rows[0].version }
  }

  const concurrent = await query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary'")
  if (!concurrent.rows[0]) throw new Error("CATALOG_SEED_FAILED")
  const catalog = normalizeCatalogConfig(concurrent.rows[0].payload)
  return { catalog: await withInventory(catalog), version: concurrent.rows[0].version }
}

export async function getCatalogAdminState() {
  const live = await getCatalogConfig()
  const result = await query<DraftRow>("SELECT payload, base_version, updated_at FROM catalog_drafts WHERE id = 'primary'")
  const draft = result.rows[0]
  if (!draft) return { ...live, draftExists: false, draftBaseVersion: null, draftUpdatedAt: null }
  const draftCatalog = normalizeCatalogConfig(draft.payload)
  const draftAvailability = await inventoryAvailabilityForCatalog(draftCatalog)
  return {
    catalog: applyInventoryAvailability(draftCatalog, draftAvailability),
    version: live.version,
    draftExists: true,
    draftBaseVersion: draft.base_version,
    draftUpdatedAt: draft.updated_at.toISOString()
  }
}

function expectedVersion(value: unknown) {
  const version = Number(value)
  if (!Number.isInteger(version) || version < 1) throw new CatalogValidationError("INVALID_VERSION")
  return version
}

export async function saveCatalogDraft(input: unknown, expected: unknown) {
  const catalog = normalizeCatalogConfig(input)
  const expectedLiveVersion = expectedVersion(expected)
  await getCatalogConfig()
  return transaction(async (client) => {
    const live = await client.query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary' FOR UPDATE")
    const current = live.rows[0]
    if (!current) throw new Error("CATALOG_NOT_INITIALIZED")
    if (current.version !== expectedLiveVersion) throw new CatalogValidationError("CATALOG_VERSION_CONFLICT")
    const result = await client.query<DraftRow>(
      `INSERT INTO catalog_drafts (id, payload, base_version, updated_at)
       VALUES ('primary', $1::jsonb, $2, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, base_version = EXCLUDED.base_version, updated_at = now()
       RETURNING payload, base_version, updated_at`,
      [JSON.stringify(catalog), current.version]
    )
    const draft = result.rows[0]
    return {
      catalog: normalizeCatalogConfig(draft.payload),
      version: current.version,
      draftExists: true,
      draftBaseVersion: draft.base_version,
      draftUpdatedAt: draft.updated_at.toISOString()
    }
  })
}

export async function discardCatalogDraft(expected: unknown) {
  const expectedLiveVersion = expectedVersion(expected)
  await getCatalogConfig()
  return transaction(async (client) => {
    const live = await client.query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary' FOR UPDATE")
    const current = live.rows[0]
    if (!current) throw new Error("CATALOG_NOT_INITIALIZED")
    if (current.version !== expectedLiveVersion) throw new CatalogValidationError("CATALOG_VERSION_CONFLICT")
    await client.query("DELETE FROM catalog_drafts WHERE id = 'primary'")
    return { catalog: normalizeCatalogConfig(current.payload), version: current.version, draftExists: false }
  })
}

export async function publishCatalogDraft(expected: unknown) {
  const expectedLiveVersion = expectedVersion(expected)
  await getCatalogConfig()
  return transaction(async (client) => {
    const live = await client.query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary' FOR UPDATE")
    const current = live.rows[0]
    if (!current) throw new Error("CATALOG_NOT_INITIALIZED")
    if (current.version !== expectedLiveVersion) throw new CatalogValidationError("CATALOG_VERSION_CONFLICT")

    const draftResult = await client.query<DraftRow>("SELECT payload, base_version, updated_at FROM catalog_drafts WHERE id = 'primary' FOR UPDATE")
    const draft = draftResult.rows[0]
    if (!draft) throw new CatalogValidationError("DRAFT_NOT_FOUND")
    if (draft.base_version !== current.version) throw new CatalogValidationError("DRAFT_OUTDATED")
    const catalog = normalizeCatalogConfig(draft.payload)

    const saved = await client.query<CatalogRow>(
      `UPDATE catalog_config SET payload = $1::jsonb, version = version + 1, updated_at = now()
       WHERE id = 'primary' RETURNING payload, version`,
      [JSON.stringify(catalog)]
    )
    if (!saved.rows[0]) throw new Error("CATALOG_NOT_INITIALIZED")
    await client.query(`INSERT INTO catalog_revisions (version, payload) VALUES ($1, $2::jsonb)`, [saved.rows[0].version, JSON.stringify(catalog)])
    await client.query("DELETE FROM catalog_drafts WHERE id = 'primary'")
    return { catalog, version: saved.rows[0].version, draftExists: false }
  })
}


export async function replaceLiveCatalog(input: unknown, expected: unknown) {
  const catalog = normalizeCatalogConfig(input)
  const expectedLiveVersion = expectedVersion(expected)
  await getCatalogConfig()
  return transaction(async (client) => {
    const live = await client.query<CatalogRow>("SELECT payload, version FROM catalog_config WHERE id = 'primary' FOR UPDATE")
    const current = live.rows[0]
    if (!current) throw new Error("CATALOG_NOT_INITIALIZED")
    if (current.version !== expectedLiveVersion) throw new CatalogValidationError("CATALOG_VERSION_CONFLICT")

    const saved = await client.query<CatalogRow>(
      `UPDATE catalog_config
         SET payload = $1::jsonb, version = version + 1, updated_at = now()
       WHERE id = 'primary'
       RETURNING payload, version`,
      [JSON.stringify(catalog)]
    )
    if (!saved.rows[0]) throw new Error("CATALOG_NOT_INITIALIZED")
    await client.query(`INSERT INTO catalog_revisions (version, payload) VALUES ($1, $2::jsonb)`, [saved.rows[0].version, JSON.stringify(catalog)])
    await client.query("DELETE FROM catalog_drafts WHERE id = 'primary'")
    return { catalog, version: saved.rows[0].version, draftExists: false }
  })
}

export async function listCatalogRevisions(limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const result = await query<RevisionRow>(
    `SELECT id::text, version, payload, created_at FROM catalog_revisions ORDER BY id DESC LIMIT $1`,
    [safeLimit]
  )
  return result.rows.map((row) => {
    const catalog = normalizeCatalogConfig(row.payload)
    return {
      id: row.id,
      version: row.version,
      createdAt: row.created_at.toISOString(),
      tiers: catalog.tiers.length,
      products: catalog.products.length,
      occasions: catalog.occasions.length
    }
  })
}

export async function rollbackCatalogRevision(revisionId: string) {
  if (!/^\d+$/.test(revisionId)) throw new CatalogValidationError("INVALID_REVISION")
  return transaction(async (client) => {
    const source = await client.query<RevisionRow>(`SELECT id::text, version, payload, created_at FROM catalog_revisions WHERE id = $1 LIMIT 1`, [revisionId])
    if (!source.rows[0]) throw new CatalogValidationError("REVISION_NOT_FOUND")
    const catalog = normalizeCatalogConfig(source.rows[0].payload)
    const saved = await client.query<CatalogRow>(
      `UPDATE catalog_config SET payload = $1::jsonb, version = version + 1, updated_at = now() WHERE id = 'primary' RETURNING payload, version`,
      [JSON.stringify(catalog)]
    )
    if (!saved.rows[0]) throw new Error("CATALOG_NOT_INITIALIZED")
    await client.query(`INSERT INTO catalog_revisions (version, payload) VALUES ($1, $2::jsonb)`, [saved.rows[0].version, JSON.stringify(catalog)])
    await client.query("DELETE FROM catalog_drafts WHERE id = 'primary'")
    return { catalog, version: saved.rows[0].version, restoredFromVersion: source.rows[0].version }
  })
}
