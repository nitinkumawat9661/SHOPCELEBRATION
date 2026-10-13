import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [budget, discovery, catalogRaw, styles, globals, storyCopy] = await Promise.all([
  "features/catalog/BudgetSection.tsx",
  "features/home/StorefrontDiscovery.tsx",
  "content/catalog.json",
  "styles/home-budget-premium-20261012.css",
  "app/globals.css",
  "lib/domain/content.ts"
].map(read))
const catalog = JSON.parse(catalogRaw)
const tiers = catalog.tiers.filter((tier) => tier.active !== false)
assert(tiers.length >= 1, "Real hamper tiers must exist")
assert.equal(new Set(tiers.map((tier) => tier.id)).size, tiers.length, "SKU-like tier identities are unique")
for (const tier of tiers) {
  assert(tier.price > 0 && Number.isFinite(tier.price), "Real, non-zero configured hamper price")
  assert(tier.name && tier.size && Number.isInteger(tier.maxChoices) && tier.maxChoices > 0,
    "Real tier name, size and max gift choice data are present")
}
assert(budget.includes("tiers.map((item) =>"), "Render every live tier, not a hard-coded shortlist")
assert(budget.includes("{formatMoney(hamperFinalPriceRupees(item.price))}") && budget.includes("{item.name}"),
  "Final tier display price includes ₹50; tier names and original catalog prices remain authoritative")
assert(budget.includes("Math.min(...tiers.map((tier) => tier.price))"), "Honest minimum starting price")
assert(budget.includes("item.maxChoices") && budget.includes("{item.size}"), "Display only configured limitations")
assert(budget.includes("Price for the complete hamper"), "Keep full hamper price clarity")
assert(budget.includes("tierBadge(item, recommendedTierId, socialProof)"), "Do not invent sale badges or social proof")
assert(budget.includes('hasChosenTier && selectedTierId === item.id') && budget.includes('aria-pressed='),
  "Preserve selection state on each tier button")
assert(budget.includes("onSelect(item.id)") && discovery.includes("openBuilder(2, id, true)"),
  "Choosing a budget must still start actual builder with exact selected tier")
assert(budget.includes('href="#custom-request"'), "Custom request route must remain live")
assert(budget.includes('role="region"') && budget.includes("tabIndex={0}") && budget.includes("rail.scrollBy"),
  "Rail must remain keyboard-focusable and desktop arrow-operable")
assert(budget.includes("prefers-reduced-motion: reduce"), "Respect reduced motion for scroll controls")
assert(styles.includes(".celebrationBudgets .tiers") && styles.includes("scroll-snap-type:x"),
  "Premium mobile carousel must be one horizontal scroll row")
assert(styles.includes("min-height:41px") && styles.includes("min-height:44px"),
  "Primary cards and request control retain touch-friendly dimensions")
assert(styles.includes("@media(max-width:700px)") && styles.includes("@media(max-width:360px)"),
  "Adapt at common and narrow phone widths")
assert(styles.includes("overflow-x:auto") && styles.includes("overscroll-behavior-x:contain"),
  "Long tier list must not cause body-wide horizontal scroll")
assert(styles.includes("prefers-reduced-motion:reduce"), "Never force motion")
assert(!styles.includes(".collectionPage") && !styles.includes(".adminPage"),
  "Budget redesign must not alter other business screens")
assert(globals.includes('@import "../styles/home-budget-premium-20261012.css";'),
  "New scoped budget styles must actually ship")
assert(globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep protected jewelry collection stylesheet ordering")
assert(storyCopy.includes('title: "Choose your hamper budget."'),
  "No changes to approved budget-section customer messaging")
console.log(`Premium budget UI safety checks passed: ${tiers.length} authentic hamper tiers, exact catalog prices and builder routing, accessible carousel, and protected product layouts.`)
