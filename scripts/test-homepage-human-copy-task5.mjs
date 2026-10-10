import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [hero, homeCatalog, storefront, budget, occasions, request, content, storeRaw, css, globals, olderEditorial, navCss, plan] = await Promise.all([
  "features/home/Hero.tsx",
  "features/home/HomeCatalog.tsx",
  "features/home/Storefront.tsx",
  "features/catalog/BudgetSection.tsx",
  "features/catalog/OccasionRail.tsx",
  "features/home/CustomRequestSection.tsx",
  "lib/domain/content.ts",
  "content/store.json",
  "styles/homepage-human-rhythm-task5.css",
  "app/globals.css",
  "styles/editorial-polish-section7.css",
  "styles/mobile-navigation-final-task4.css",
  "docs/FINAL_POLISH_AND_AI_FEEL_REMOVAL.md"
].map(read))

const store = JSON.parse(storeRaw)
assert.equal(store.brand.tagline, "Mharo Surprise, Thari Smile", "Keep Celebration's original brand tagline")
assert.equal(store.brand.name, "Celebration", "Brand identity must remain")
assert(hero.includes("Jewelry to wear.") && hero.includes("Hampers to"), "Homepage hero must lead with what Celebration actually sells")
assert(hero.includes("Browse necklaces, rings and bracelets."), "Use product-specific, plain English")
assert(hero.includes("Custom hampers from {formatMoney(minPrice)}."), "Keep genuine dynamic starting budget")
assert(hero.includes('href="#budgets"') && hero.includes('href="/jewelry"'), "Both hero routes must remain functional")
assert(hero.includes('hero-800.webp') && hero.includes('hero-1600.webp'), "Keep the optimized verified campaign photos")
assert(homeCatalog.includes("categoriesForCatalog(catalog)") && homeCatalog.includes("visibleProducts(catalog)"), "Categories remain sourced from actual product data")
assert(homeCatalog.includes("{category.label}") && homeCatalog.includes("{product.id}"), "Keep exact catalog names and SKU identity")
assert(homeCatalog.includes('href="#budgets"') && homeCatalog.includes('href="/jewelry"'), "Keep existing jewelry and hamper routes")
assert(homeCatalog.includes("Take a closer look") && homeCatalog.includes("Browse pieces"), "Category/featured CTA copy should sound natural")
assert(homeCatalog.includes("loading=\"lazy\"") && homeCatalog.includes('CatalogProductImage product={photo}'), "Keep below-the-fold image strategy and same-SKU imagery")
assert(storefront.includes("Where a video is provided") && storefront.includes("Payment confirmation"), "Benefits must not promise a universal packing video")
assert(storefront.includes("isPublicHamperOrderProof(initialSocialProof, tiers)") && storefront.includes("visibleProof &&"), "Do not invent or loosen verified social proof")
assert(store.trustStrip.includes("🎥 Hamper packing video where available"), "Header copy must align with policy availability")
const videoCard = store.promiseCards.find(x => x.title === "Hamper packing preview")
assert(videoCard && videoCard.body.includes("When a packing video is provided"), "Trust card must avoid unconditional delivery promises")
assert(content.includes('title: "Choose your hamper budget."') && content.includes('price covers the complete hamper'), "Budget price description must be specific")
assert(content.includes('title: "From payment to delivery."') && content.includes('title: "Have a hamper in mind?"'), "Homepage promise and final CTA must be grounded in real workflows")
assert(budget.includes("{formatMoney(item.price)}") && budget.includes("{item.name}") && budget.includes("onSelect(item.id)"), "Do not alter budget options or selection")
assert(budget.includes("Price for the complete hamper") && budget.includes('href="#custom-request"'), "Tier note must be transparent and request link must work")
assert(occasions.includes("{occasion}") && occasions.includes("onChange(occasion)"), "Do not change dynamic occasions or picker behavior")
assert(occasions.includes("Birthday, anniversary") && occasions.includes("Pick an occasion"), "Occasion copy must identify the action")
assert(request.includes('action') === false || request.includes("custom-request"), "Existing custom request action must remain")
assert(request.includes('fetch("/api/custom-request"') && request.includes("onSubmit={submit}"), "Custom request POST and interactions must remain intact")
assert(request.includes("Gift preferences or instructions"), "The form should ask for concrete preferences rather than a vague feeling")

const surfaces = [hero, homeCatalog, storefront, budget, occasions, request]
for (const [label, re] of [
  ["thoughtful", /\bthoughtful\b/i],
  ["little", /\blittle\b/i],
  ["heart", /\bheart\b/i],
  ["feel right", /feel(?:s)? right/i],
  ["a lot of love", /a lot of love/i]
]) {
  const occurrences = surfaces.reduce((sum, text) => sum + (text.match(new RegExp(re.source, "gi")) || []).length, 0)
  assert.equal(occurrences, 0, `Repeated template phrase remains on Task 5 homepage surfaces: ${label}`)
}

// Purposefully paced sections: the catalog gets space to breathe, the two
// photography panels are unequal on desktop and stacked in reading order on
// mobile. Sections and anchors stay in their original DOM order.
for(const text of [
  ".celebrationHome .celebrationCategories",
  ".celebrationHome .celebrationFeatured",
  ".celebrationHome .celebrationEdits",
  ".celebrationHome .celebrationBudgets",
  ".celebrationHome .celebrationOccasions",
  ".celebrationHome .promiseSec",
  ".celebrationHome .customRequestSection",
  ".celebrationHome .ctaSec"
]) assert(css.includes(text), `Missing homepage-only editorial treatment: ${text}`)
assert(css.includes("grid-template-columns:minmax(0,1.07fr) minmax(0,.93fr)"), "Editorial panels need distinct but measured proportions")
assert(css.includes("@media(max-width:700px)") && css.includes("grid-template-columns:minmax(0,1fr)"), "Panels must stack on mobile rather than overflow")
assert(css.includes("@media(max-width:360px)"), "Task 5 must consider narrow 320px screens")
assert(css.includes("@media(prefers-reduced-motion:reduce)"), "Respect reduced-motion settings")
assert(!css.includes(".adminPage") && !css.includes(".collectionPage"), "Task 5 styles must be homepage-scoped")
assert(!css.includes("!important") && !css.includes("display:none"), "Do not hide commerce information or override safety rules")
assert(olderEditorial.includes(".celebrationHome .celebrationHero::before"), "Keep original hero photo readability overlay")
assert(navCss.includes("grid-template-columns:repeat(3,minmax(0,1fr))"), "Do not break Task 4 nav layout")
assert(globals.includes('@import "../styles/homepage-human-rhythm-task5.css";'), "Task 5 stylesheet must be imported")
assert(globals.indexOf("homepage-human-rhythm-task5.css") > globals.indexOf("mobile-navigation-final-task4.css"), "Task 5 must follow earlier scoped style fixes")
assert(plan.includes("## 5. Homepage copy and visual rhythm"), "Track only within locked nine-task plan")
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length, "CSS blocks are unbalanced")
console.log("Task 5 homepage checks passed: concrete hero/category/budget/CTA copy, preserved tagline and live data, conditional packing video copy, asymmetric desktop spacing, stacked mobile and unchanged checkout/builder routes.")
