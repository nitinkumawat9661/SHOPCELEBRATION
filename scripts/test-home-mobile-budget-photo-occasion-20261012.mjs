import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [budget, budgetStyles, imageCard, imageStyle, home, occasion, occasionStyles, builder, rawCatalog, imports] = await Promise.all([
  "features/catalog/BudgetSection.tsx",
  "styles/home-mobile-budget-featured-fix-20261012.css",
  "features/catalog/CatalogCard.tsx",
  "styles/home-phase1-original-featured-grid-20261012.css",
  "features/home/HomeCatalog.tsx",
  "features/catalog/OccasionRail.tsx",
  "styles/home-occasion-refined-20261012.css",
  "features/home/StorefrontDiscovery.tsx",
  "content/catalog.json",
  "app/globals.css"
].map(read))

const catalog = JSON.parse(rawCatalog)
const tiers = catalog.tiers.filter((tier) => tier.active !== false)

assert.equal(tiers.length, 12, "Live catalog currently exposes 12 budget options")
assert(budget.includes("tiers.map((item) =>") && budget.includes("onSelect(item.id)"),
  "Card redesign must keep all genuine tier IDs wired to existing builder")
assert(budget.includes("celebrationTierMain") && budget.includes("celebrationHamperCard"),
  "Group amount and name as a single flowing card section rather than overlapping siblings")
assert(budget.includes("{formatMoney(item.price)}") && budget.includes("{item.name}"),
  "Use actual configured prices/names")
assert(budget.includes("item.maxChoices") && budget.includes("item.size"),
  "Sizes and choice limits must be real tier attributes")
assert(budget.includes("tierBadge(item, recommendedTierId, socialProof)"),
  "Badge recommendations must not invent popularity")
assert(budget.includes("Price for the complete hamper") && budget.includes('href="#custom-request"'),
  "Transparent complete-hamper price and custom request flow")
assert(builder.includes("openBuilder(2, id, true)"),
  "Clicking a budget must retain correct quick-start builder event")
assert(budgetStyles.includes(".celebrationTierMain") &&
  budgetStyles.includes("white-space:normal") && budgetStyles.includes("word-break:normal") &&
  budgetStyles.includes("height:auto") && budgetStyles.includes("max-height:none"),
  "Budget price/title must expand naturally and avoid word splitting or clipping")
assert(budgetStyles.includes("celebrationHamperCard::before") && budgetStyles.includes("celebrationHamperCard::after"),
  "Decorative overlay layers must not cover mobile text")
assert(budgetStyles.includes("flex-direction:column") && budgetStyles.includes("@media(max-width:360px)"),
  "Stack text in a consistent mobile card at narrow screen widths")

assert(imageCard.includes('imageVariant = "thumb"'),
  "All original listing cards must keep the same image URL variant")
assert(imageCard.includes("catalogImageVariant(primary.url, imageVariant)"),
  "Featured image must come from its own exact SKU")
assert(home.includes('<CatalogCard key={product.id} product={product} imageVariant="main" />'),
  "Featured cards should use full-resolution authentic main images")
assert(imageStyle.includes("display:grid") && imageStyle.includes("grid-template-columns:repeat(2,minmax(0,1fr))") && imageStyle.includes("grid-template-columns:repeat(4,minmax(0,1fr))") && imageStyle.includes("scroll-snap-type:none"), "Take a closer look follows owner\'s approved original grid, not swipe")
assert(budgetStyles.includes(".celebrationFeatured .catalogCardVisual") &&
  budgetStyles.includes("object-fit:contain") &&
  budgetStyles.includes(".catalogCardMedia .safeCatalogImageFrame"),
  "Featured photos must preserve complete product framing in a stable visual area")
assert(!home.includes('src="https://images.unsplash.com/'),
  "No replacement stock photograph in actual product listings")

assert(occasion.includes("occasions.map((occasion)") && occasion.includes("onChange(occasion)"),
  "Render real eight configured occasions and preserve builder selection")
assert.equal(new Set(catalog.occasions).size, catalog.occasions.length,
  "Catalog contains non-duplicated real occasions")
assert(occasion.includes('aria-pressed={value === occasion}'),
  "Occasion has correct selected state")
assert(occasion.includes("Birthday, anniversary") && occasion.includes("Pick an occasion"),
  "Retain approved occasion messaging")
assert(occasionStyles.includes("background-image:linear-gradient") &&
  !occasionStyles.includes("url('/images/campaign/occasion-"),
  "No busy photograph behind occasion text")
assert(occasionStyles.includes("scroll-snap-type:x proximity") &&
  occasionStyles.includes("overflow-x:auto") &&
  occasionStyles.includes("@media(max-width:700px)"),
  "Occasion browsing remains tappable/swipeable on mobile")
assert(occasionStyles.includes(".celebrationOccasionArrow") &&
  occasionStyles.includes("min-height:55px"),
  "Visible action and mobile-sized tap targets")

for(const path of ["home-mobile-budget-featured-fix-20261012.css", "home-occasion-refined-20261012.css"]) {
  assert(imports.includes(`@import "../styles/${path}";`),
    `Ensure ${path} ships in production`)
}
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Keep protected jewelry mobile grid stylesheet last")
console.log(`Homepage refinement checks passed: ${tiers.length} real hamper budgets with unoverlapped flowing text, main SKU imagery and ${catalog.occasions.length} real clickable occasions.`)
