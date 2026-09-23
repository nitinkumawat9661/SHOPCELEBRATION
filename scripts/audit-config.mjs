import { readFile } from "node:fs/promises"

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))
const catalog = await readJson("../content/catalog.json")
const workflow = await readJson("../config/order-workflow.json")
const store = await readJson("../content/store.json")
const payment = await readJson("../config/payment.json")
const storage = await readJson("../config/storage.json")
const adminOrders = await readJson("../config/admin-orders.json")
const errors = []

const unique = (items, field, label) => {
  const seen = new Set()
  for (const item of items) {
    const value = item[field]
    if (!value) errors.push(`${label} missing ${field}`)
    if (seen.has(value)) errors.push(`${label} duplicate ${field}: ${value}`)
    seen.add(value)
  }
}

unique(catalog.tiers, "id", "tier")
unique(catalog.products, "id", "product")
const tierIds = new Set(catalog.tiers.map((tier) => tier.id))
const tierPrices = new Set(catalog.tiers.map((tier) => tier.price))
for (const tier of catalog.tiers) {
  if (!Number.isInteger(tier.price) || tier.price <= 0) errors.push(`invalid tier price: ${tier.id}`)
  if (!Number.isInteger(tier.maxChoices) || tier.maxChoices < 1) errors.push(`invalid maxChoices: ${tier.id}`)
  if (!Number.isInteger(tier.pointBudget) || tier.pointBudget < tier.maxChoices) errors.push(`invalid pointBudget: ${tier.id}`)
}
for (const product of catalog.products) {
  if (!tierPrices.has(product.minTier)) errors.push(`product minTier has no matching tier: ${product.id}`)
  if (!Number.isInteger(product.points) || product.points < 1) errors.push(`invalid product points: ${product.id}`)
  if (!product.icon || !product.name || !product.category) errors.push(`incomplete product: ${product.id}`)
}
if (!tierIds.has(catalog.settings?.defaultTierId)) errors.push("defaultTierId does not match a tier")
if (!catalog.occasions?.includes(catalog.settings?.defaultOccasion)) errors.push("defaultOccasion is not in occasions")
if (!catalog.settings?.allCategory?.id || !catalog.settings?.allCategory?.label) errors.push("allCategory config incomplete")
if (new Set(catalog.products.map((item) => item.category)).has(catalog.settings?.allCategory?.id)) errors.push("allCategory id collides with product category")

const statuses = new Set(workflow.statuses)
unique(workflow.statuses.map((id) => ({ id })), "id", "status")
for (const status of workflow.statuses) {
  if (!Array.isArray(workflow.transitions?.[status])) errors.push(`missing transitions: ${status}`)
  for (const next of workflow.transitions?.[status] || []) if (!statuses.has(next)) errors.push(`unknown transition ${status} -> ${next}`)
}
for (const key of Object.keys(workflow.transitions || {})) if (!statuses.has(key)) errors.push(`transition key is not a status: ${key}`)
for (const status of workflow.customerTimeline || []) if (!statuses.has(status)) errors.push(`unknown timeline status: ${status}`)
for (const [status] of Object.entries(workflow.paymentStatusByOrderStatus || {})) if (!statuses.has(status)) errors.push(`payment status mapping uses unknown status: ${status}`)
for (const [capability, values] of Object.entries(workflow.capabilities || {})) {
  if (!Array.isArray(values)) errors.push(`capability is not an array: ${capability}`)
  for (const status of values || []) if (!statuses.has(status)) errors.push(`capability ${capability} uses unknown status: ${status}`)
}
for (const [action, status] of Object.entries(workflow.actions || {})) if (!statuses.has(status)) errors.push(`action ${action} uses unknown status: ${status}`)
for (const status of workflow.adminTransitionTargets || []) if (!statuses.has(status)) errors.push(`admin target uses unknown status: ${status}`)

const adminFilterIds = new Set()
for (const filter of adminOrders.filters || []) {
  if (!filter.id || adminFilterIds.has(filter.id)) errors.push(`invalid/duplicate admin filter: ${filter.id || "missing"}`)
  adminFilterIds.add(filter.id)
  if (!Array.isArray(filter.statuses)) errors.push(`admin filter statuses missing: ${filter.id}`)
  for (const status of filter.statuses || []) if (!statuses.has(status)) errors.push(`admin filter ${filter.id} uses unknown status: ${status}`)
}
if (!adminFilterIds.has(adminOrders.defaultFilter)) errors.push("default admin filter is not configured")

if (!payment.currencyCode || !payment.locale || !payment.upiScheme) errors.push("payment config incomplete")
if (!Number.isInteger(payment.minorUnitFactor) || payment.minorUnitFactor < 1) errors.push("invalid payment minorUnitFactor")
if (!storage.packingVideoTypes || Object.keys(storage.packingVideoTypes).length === 0) errors.push("video content types missing")
if (!Array.isArray(store.issues?.types) || store.issues.types.length === 0) errors.push("issue types are missing")
if (!store.brand?.name || !store.brand?.tagline) errors.push("brand content incomplete")

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`Config audit passed: ${catalog.tiers.length} tiers, ${catalog.products.length} products, ${workflow.statuses.length} statuses.`)
