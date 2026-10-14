import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (f) => readFile(new URL(`../${f}`, import.meta.url), "utf8")
const [home, featured, budget, storefront, discovery, events, tail, header, strip, promise, cta, css, globals, catalogRaw, storeRaw, delivery] = await Promise.all([
  "features/home/BalancedHomepage.tsx",
  "features/home/FeaturedHamperCards.tsx",
  "features/catalog/BudgetSection.tsx",
  "features/home/Storefront.tsx",
  "features/home/StorefrontDiscovery.tsx",
  "features/builder/builder-events.ts",
  "features/home/StorefrontTail.tsx",
  "features/shell/StorefrontHeader.tsx",
  "features/shell/TrustStrip.tsx",
  "features/home/PromiseSection.tsx",
  "features/home/FinalCta.tsx",
  "styles/home-balanced-20261014.css",
  "app/globals.css",
  "content/catalog.json",
  "content/store.json",
  "config/self-build-delivery.ts"
].map(read))
const catalog = JSON.parse(catalogRaw), store = JSON.parse(storeRaw)
assert.equal(store.brand.name, "Celebration")
assert.equal(store.brand.tagline, "Mharo Surprise, Thari Smile")
assert.equal(store.brand.themeColor.toLowerCase(), "#7a1f24")
assert(store.trustStrip.length === 6 && strip.includes("storeContent.trustStrip"), "Keep exact six trust messages")
assert(header.includes("Search jewelry and gifts…") && header.includes("<CartLink />") &&
  header.includes("<WishlistHeaderLink />") && header.includes("<NotificationLink />"),
  "Existing functional account/search/cart header must remain")
assert(storefront.includes("<TrustStrip />") && storefront.includes("<BalancedHomepage") &&
  storefront.includes("<StorefrontDiscovery"), "Render new home without bypassing working checkout")
for (const phrase of [
  "Jewelry to", "Hampers to", "Explore Jewelry", "Build Hamper",
  "Shop by category", "Take a closer look", "Jewelry to love", "Hampers to gift"
]) assert(home.includes(phrase), `Missing required homepage phrase: ${phrase}`)
assert(home.includes('JEWELRY_CATEGORIES.map(') && home.includes('HAMPER_CATEGORIES.map('), "Two separate category groups")
assert.equal((home.match(/label: "(?:Mini|Classic|Premium|Luxury|Occasion|Build Your Own)/g) || []).length,6, "Six hamper category tiles")
assert.equal((home.match(/"[^"]+(?:Necklaces|Sets|Bracelets|Rings|Earrings)"/g) || []).length >= 6,true,"Six jewelry categories")
assert(home.includes("CatalogCard") && home.includes("isIndividuallySellable") &&
 home.includes("primaryProductImage"), "Featured jewelry must be real sellable exact-SKU items")
assert(home.includes("slice(0, 4)") && home.includes('["t499", "t699", "t999", "t1499"]'),
 "Exactly four featured jewelry and four hamper examples")
assert(featured.includes('requestBuilderOpen(2, tier.id)') &&
  events.includes("tierId?: string") && discovery.includes("detail?.tierId") &&
  discovery.includes("setSelectedTierId(requested.id)"), "Featured hamper CTA must select the matching tier")
assert(featured.includes("Curated for your occasion") && featured.includes("Choose this hamper"),
 "Keep gift card text and CTA")
const required=[299,399,499,699,999,1499,2499,5000]
const ids=required.map(v=>`t${v}`)
const declared=budget.match(/const HOMEPAGE_TIER_ORDER = \[([^\]]+)\]/)?.[1] || ""
assert.deepEqual([...declared.matchAll(/"t(\d+)"/g)].map(x=>Number(x[1])),required,
 "Budget grid must show exactly eight owner-selected tiers in order")
for(const id of ids) assert(catalog.tiers.some(x=>x.id===id),"Requested budget must exist in source catalog: "+id)
assert(budget.includes("onSelect(item.id)") && budget.includes("aria-pressed={chosen}"),"Budget buttons remain accessible and functional")
assert(budget.includes("item.price + totalDelivery") && featured.includes("deliveryFee") &&
  delivery.includes("HAMPER_DELIVERY_FEE_PAISE"),"Disclose existing extra delivery charge, preserve backend price")
assert(budget.includes("Most chosen") && budget.includes("socialProof && item.name === socialProof.tierName"),
 "Only verified aggregate data can produce popularity badges")
assert(tail.includes("builderActive && <LazyHamperBuilder") &&
 tail.includes("<PromiseSection />") && tail.includes("<FinalCta"),
 "Do not show builder as an extra section until called, keep final section order")
assert(promise.includes("From payment to delivery") && promise.includes("storeContent.promiseCards.slice(0, 4)") &&
 promise.includes("StoreIcon"),"Four elegant verified trust cards")
assert(cta.includes("Still deciding what to send?") && cta.includes("Build a custom hamper") &&
 cta.includes("onClick={onBuild}"),"Final CTA opens working hamper builder")
assert(css.includes("#fffaf4") && css.includes("#7a1f24") &&
 css.includes("grid-template-columns:repeat(2,minmax(0,1fr))") &&
 css.includes("grid-template-columns:repeat(4,minmax(0,1fr))"),"Cream/burgundy responsive 50/50")
assert(css.includes("@media(max-width:700px)") && css.includes("@media(prefers-reduced-motion:reduce)"),
 "Mobile and reduced-motion rules exist")
assert(!css.includes(".cartPage") && !css.includes(".adminPage") &&
 !css.includes(".checkoutPage"),"New CSS must not alter operational pages")
assert(globals.includes('@import "../styles/home-balanced-20261014.css";'),"Load homepage CSS")
assert(globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
 "Preserve existing protected listing CSS ordering")
console.log("Balanced homepage checks passed: brand, functional builder, catalog integrity, 50/50 layouts, eight budgets, honest final totals and responsive trust/CTA.")
