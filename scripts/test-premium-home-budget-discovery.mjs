import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = file => readFile(new URL("../"+file,import.meta.url),"utf8")
const [discovery,curated,route,hero,homeCatalog,header,footer,catalogText,globalCss] = await Promise.all([
  "features/home/StorefrontDiscovery.tsx",
  "features/builder/CuratedHamperFlow.tsx",
  "app/curated-hampers/page.tsx",
  "features/home/Hero.tsx",
  "features/home/HomeCatalog.tsx",
  "features/shell/StorefrontHeader.tsx",
  "features/shell/SiteFooter.tsx",
  "content/catalog.json",
  "app/globals.css"
].map(read))
const tiers=JSON.parse(catalogText).tiers.filter(t=>t.active!==false)
assert(tiers.length>=1&&new Set(tiers.map(t=>t.id)).size===tiers.length,
  "Published hamper tiers remain real and uniquely identified")
assert(!discovery.includes("<BudgetSection")&&!discovery.includes('from "../catalog/BudgetSection"'),
  "Owner removed redundant 12-card homepage budget carousel, not the curated budget page")
assert(curated.includes("state.tiers.map((item) =>")&&curated.includes("chooseBudget(item.id)")&&
  curated.includes("formatMoney(hamperFinalPriceRupees(item.price))")&&
  curated.includes("Review & Pay"),
  "Dedicated curated budget choices must keep genuine tier prices and real checkout")
assert(route.includes("<CuratedHamperFlow catalog={catalog} />")&&
  route.includes('canonical: "/curated-hampers"'),
  "Existing standalone Curated Hampers route remains the source of truth")
for(const source of [hero,homeCatalog,header,footer])
  assert(source.includes('"/curated-hampers"')&&!source.includes("#budgets"),
    "Hamper navigation must reach dedicated budget page, never a removed anchor")
assert(!discovery.includes('id="budgets"')&&
  globalCss.includes('jewelry-two-column-scroll-header-fix.css'),
  "No hidden placeholder carousel or global CSS reorder")
console.log("DEDUPLICATED_HOMEPAGE_BUDGET_ROUTE_PASSED: no duplicate rail, curated tiers and actual payment remain")
