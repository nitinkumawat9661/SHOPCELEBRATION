import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")
const [server, badge, catalog, card, detail, home, listing, css, globals, plan, individualTests] = await Promise.all([
  "lib/server/product-badge-evidence.ts",
  "lib/domain/catalog-badges.ts",
  "lib/domain/catalog.ts",
  "features/catalog/CatalogCard.tsx",
  "app/jewelry/[id]/page.tsx",
  "app/page.tsx",
  "app/jewelry/page.tsx",
  "styles/verified-catalog-badges.css",
  "app/globals.css",
  "docs/FINAL_POLISH_AND_AI_FEEL_REMOVAL.md",
  "scripts/test-individual-catalog.mjs"
].map(read))
const begin = server.indexOf("export function attachVerifiedBadgeSignals(")
const end = server.indexOf("/** For public storefront pages only.", begin)
assert(begin > 0 && end > begin, "Real badge evidence mapper must be independently testable")
const generated = ts.transpileModule(server.slice(begin, end), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const exportsRef = {}
vm.runInNewContext(generated, { exports: exportsRef })
const attach = exportsRef.attachVerifiedBadgeSignals
assert.equal(typeof attach, "function", "Badge metadata mapper must execute")

const now = Date.parse("2026-10-10T10:00:00.000Z")
const catalogFixture = {
  settings: {},
  tiers: [],
  occasions: [],
  products: [
    { id: "n-a", name: "A", category: "Necklaces", sellIndividually: true, badge: "Bestseller", stockAvailable: 8 },
    { id: "n-b", name: "B", category: "Necklaces", sellIndividually: true, badge: "", stockAvailable: 7 },
    { id: "n-c", name: "C", category: "Rings", sellIndividually: true, badge: "New", stockAvailable: 2 },
    { id: "n-d", name: "D", category: "Rings", sellIndividually: true, badge: "", stockAvailable: 0 },
    { id: "n-e", name: "E", category: "Necklaces", sellIndividually: false, badge: "Bestseller" },
    { id: "n-f", name: "F", category: "Necklaces", sellIndividually: true, active: false, badge: "New" }
  ]
}
const evidence = {
  sales: [
    { id: "n-a", orders: 5 },
    { id: "n-b", orders: 7 },
    { id: "n-c", orders: 1 },
    { id: "n-d", orders: 80 },
    { id: "n-e", orders: 30 },
    { id: "n-f", orders: 20 }
  ],
  publications: [
    { id: "n-a", version: 1, publishedAt: "2026-10-09T10:00:00.000Z" },
    { id: "n-b", version: 2, publishedAt: "2026-08-01T10:00:00.000Z" },
    { id: "n-c", version: 2, publishedAt: "2026-10-06T10:00:00.000Z" },
    { id: "n-d", version: 3, publishedAt: "2026-10-06T10:00:00.000Z" },
    { id: "n-e", version: 4, publishedAt: "2026-10-06T10:00:00.000Z" },
    { id: "n-f", version: 5, publishedAt: "2026-10-06T10:00:00.000Z" }
  ]
}
const updated = attach(catalogFixture, evidence, now)
const [a,b,c,d,e,f] = updated.products
assert(!a.badgeSignals.bestsellerOrders, "5 sales is not enough if another SKU in the category is more popular")
assert(!a.badgeSignals.firstPublishedAt, "First seed revision must not count as a newly published SKU")
assert.equal(b.badgeSignals.bestsellerOrders, 7, "Category leader with >=5 confirmed deliveries should qualify")
assert.equal(c.badgeSignals.firstRevisionVersion, 2, "Recently published SKU must be linked to a real non-seed revision")
assert(!c.badgeSignals.bestsellerOrders, "Unverified one-order product must not look popular")
assert.equal(d.badgeSignals.bestsellerOrders, 80, "Server evidence remains factual even for sold-out products; rendering must take sold-out precedence")
assert.equal(e.badgeSignals, undefined, "Hamper-only SKU must not get individual-sales claims")
assert.equal(f.badgeSignals, undefined, "Inactive SKU must never get storefront badge metadata")
assert.equal(catalogFixture.products[1].badgeSignals, undefined, "Attach function must not mutate stored catalog")
const expired = attach(catalogFixture, { sales: [], publications: [{ id: "n-c", version: 2, publishedAt: "2026-08-01T10:00:00.000Z" }] }, now)
assert.equal(Object.keys(expired.products[2].badgeSignals).length, 0, "Expired New claim must not be emitted")
const future = attach(catalogFixture, { sales: [], publications: [{ id: "n-c", version: 4, publishedAt: "2026-12-01T10:00:00.000Z" }] }, now)
assert.equal(Object.keys(future.products[2].badgeSignals).length, 0, "Future publication cannot become New")
const tampered = attach(catalogFixture, { sales: [{ id: "n-b", orders: -12 }, { id: "n-a", orders: Number.NaN }] , publications: [] }, now)
assert.equal(Object.keys(tampered.products[1].badgeSignals).length, 0, "Invalid sales counts are rejected")

for(const snippet of [
  "orders.order_type = 'individual'",
  "orders.status = 'delivered'",
  "orders.payment_status IN ('paid', 'verified', 'success')",
  "orders.created_at >= now() - interval '120 days'",
  "count(DISTINCT orders.id)::int",
  "catalog_revisions",
  "min(revision.version)::int",
  "revision.created_at",
  "revalidate: 120"
]) assert(server.includes(snippet), `Required database evidence or cache control missing: ${snippet}`)
assert(!server.includes("Math.random"), "No synthetic signal generation")
assert(badge.includes("bestsellerOrders") && badge.includes("firstRevisionVersion"), "Badge renderer requires server evidence")
assert(badge.includes("NEW_WINDOW_MS"), "New claim must expire")
assert(badge.includes('product.stockAvailable! >= 1 && product.stockAvailable! <= 3'), "Limited requires real scarcity")
assert(badge.includes("percent !== 25") && badge.includes("productDiscountPercent(product)"), "No repetitive legacy 25% badge")
assert(individualTests.includes('Admin payload must not fabricate verified badge evidence'), "Server normalization must discard admin-supplied claims")
assert(card.includes("MRP {formatMoney(mrpPaise / 100)}") && detail.includes("MRP {formatMoney(mrpPaise / 100)}"), "Valid displayed MRP should remain visible")
assert(card.includes('badge?.kind !== "discount"'), "Do not repeat the same discount claim in badge and price text")
assert(home.includes("withVerifiedStorefrontBadges("), "Homepage must load verified badge data")
assert(listing.includes("withVerifiedStorefrontBadges("), "Collection must load verified badge data")
assert(detail.includes("withVerifiedStorefrontBadges("), "Detail and related products must load verified badge data")
for(const category of ["--sold-out","--bestseller","--new","--limited","--discount"])assert(css.includes("catalogCardBadge"+category), `No distinct UI for ${category}`)
assert(css.includes("@media(max-width:700px)") && css.includes("overflow-wrap:anywhere"), "Badges must remain readable on small phones")
assert(globals.includes('@import "../styles/verified-catalog-badges.css";') && globals.indexOf("verified-catalog-badges.css") > globals.indexOf("product-card-natural-presentation.css"), "Verified badge CSS must load after earlier card styling")
assert(globals.indexOf("mobile-navigation-final-task4.css") > globals.indexOf("verified-catalog-badges.css"), "Later scoped mobile navigation must not displace verified badges")
assert(plan.includes("## 3. Dynamic and truthful badges/discounts"), "Keep locked Task 3 document intact")
console.log("Task 3 verified badges: live DB evidence SQL, sales/category thresholds, publish-date guard, MRP comparison, legacy Save suppression, mobile UI and admin tampering protections passed.")
