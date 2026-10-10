import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [styles, globalCss, hero, homeCatalog, storefront, collection, header, mobile, plan, layout] = await Promise.all([
  read("styles/editorial-polish-section7.css"),
  read("app/globals.css"),
  read("features/home/Hero.tsx"),
  read("features/home/HomeCatalog.tsx"),
  read("features/home/Storefront.tsx"),
  read("features/catalog/CatalogCollection.tsx"),
  read("features/shell/StorefrontHeader.tsx"),
  read("styles/mobile-storefront-section6.css"),
  read("docs/WEBSITE_FINAL_IMPROVEMENT_PLAN.md"),
  read("app/layout.tsx")
])

assert(globalCss.includes('@import "../styles/editorial-polish-section7.css";'), "Editorial CSS must remain loaded")
assert(globalCss.indexOf("editorial-polish-section7.css") > globalCss.indexOf("mobile-storefront-section6.css"), "Keep Section 6 mobile safeguards before editorial overrides")
assert(globalCss.indexOf("faq-and-final-polish.css") > globalCss.indexOf("editorial-polish-section7.css"), "Section 8 may follow, without removing editorial styles")
assert(globalCss.indexOf("mobile-storefront-section6.css") < globalCss.indexOf("editorial-polish-section7.css"), "Maintain the full mobile fixes before the final editorial cascade")
assert(layout.includes("bodoni-moda-latin.woff2") && layout.includes("inter-latin.woff2"), "Use the existing locally bundled display and body fonts")
assert(styles.includes("var(--font-shopping-display)") && styles.includes("var(--font-shopping-sans)"), "Editorial design should retain the site's own serif/sans font pairing")

// Do not change checkout, admin UI, product identity or interaction sizes.
assert(styles.includes(".celebrationHome") && styles.includes(".collectionPage") && styles.includes(".ourStoryPage"), "Scope design work to customer-facing areas")
assert(!styles.includes(".adminPage") && !styles.includes(".cartCheckoutButton"), "Leave operational and checkout styles alone")
assert(!styles.includes("display:none!important"), "Never hide product details or interactions in this polish")
assert(mobile.includes("min-height:44px") && mobile.includes("grid-template-columns:44px"), "Keep Section 6 touch-target protections intact")
assert(/@media\s*\(max-width:700px\)/.test(styles), "Editorial rules must adjust for phones")
assert(/@media\s*\(prefers-reduced-motion:reduce\)/.test(styles), "Reduce motion for people requesting it")
assert.match(styles, /\.celebrationHome \.celebrationHero::before/, "Maintain photographic-hero text contrast")
assert.match(styles, /\.collectionPage \.collectionHeroShade/, "Maintain collection-hero text contrast")
assert.match(styles, /\.celebrationHome \.celebrationFeatured/, "Deliberately vary section spacing")
assert.match(styles, /\.celebrationHome \.celebrationBudgets \.tier:nth-child/, "Budget tiers need restrained editorial variety")
assert.match(styles, /\.collectionPage \.collectionGrid \.catalogCard:nth-child/, "Product-card treatments should vary without changing order")
assert.match(styles, /\.ourStoryPage \.ourStoryProse/, "Our Story prose should have a distinct reading rhythm")
assert.match(styles, /\.ourStoryPage \.ourStoryNote blockquote/, "Our Story statement should use an editorial serif")
assert.match(styles, /\.celebrationHome \.celebrationButton\.light/, "Secondary CTA needs a distinct but consistent shape")
assert.match(styles, /\.collectionPage \.collectionGrid \.catalogCardBadge--new/, "Preserve fact-based badges with a lighter treatment")

// Check the new copy is natural and that functional routes and brand facts are intact.
assert(hero.includes("Browse necklaces, rings and bracelets.") && hero.includes("Custom hampers from {formatMoney(minPrice)}."), "Hero copy must explain the real catalog without changing prices")
assert(hero.includes("Jewelry to wear.") && hero.includes("Hampers to") && hero.includes("Shop Hampers") && hero.includes('href="/jewelry"'), "Keep hero, catalog categories and both shopping CTAs")
assert(homeCatalog.includes("Take a closer look") && homeCatalog.includes("Start with") && homeCatalog.includes("your budget."), "Use specific editorial headings")
assert(homeCatalog.includes("CatalogCard") && homeCatalog.includes("{product.id}") && homeCatalog.includes('href="#budgets"'), "Keep homepage catalog identity and hamper CTA")
assert(storefront.includes("Prepared for dispatch") && storefront.includes("Track your order") && storefront.includes("Where a video is provided"), "Explain existing benefits without overpromising packing videos")
assert(collection.includes("Jewelry for your everyday.") && collection.includes("Putting a hamper together?"), "Replace repetitive marketing phrases")
assert(collection.includes("discoverProducts(products, filters)") && collection.includes("<CatalogCard key={product.id} product={product} />"), "Do not change filters or product identity")
assert(header.includes("Search jewelry and gifts…") && header.includes("<CartLink />"), "Keep search and cart navigation")
assert(plan.includes("## 7. AI फील") && plan.includes("## 8. बाकी"), "Do not expand beyond planned Section 7")
assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length, "CSS brackets must balance")
console.log("Section 7 checks passed: local fonts, type contrast, natural copy, varied spacing/cards, unchanged routes and mobile safeguards.")
