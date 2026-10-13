#!/usr/bin/env node
// Browser reliability: no inactive SSR buttons that swallow buyer interactions;
// post-deploy browser audits must wait for actual interactive React controls.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [occasion,filters,homeAudit,jewelryAudit]=await Promise.all([
  read("features/catalog/OccasionRail.tsx"),
  read("features/catalog/JewelryMarketplaceFilters.tsx"),
  read("scripts/audit-phase1-home-navigation-20261012.mjs"),
  read("scripts/audit-phase2-jewelry-final-browser.mjs")
])
assert.match(occasion,/const \[hydrated, setHydrated\] = useState\(false\)/)
assert.match(occasion,/disabled=\{!hydrated\}/)
assert.match(occasion,/useEffect\(\(\) => \{ setHydrated\(true\) \}, \[\]\)/)
assert.equal((filters.match(/disabled=\{!hydrated\}/g)||[]).length,4,
  "Sort, category, price and clear must be disabled until real handlers attach")
assert.ok(homeAudit.includes('page.locator("#builder .tierSmall").waitFor') &&
  !homeAudit.includes('await page.locator("#builder .stepPane").waitFor'),
  "An older persisted delivery form must never pass the occasion-to-budget test")
assert.ok(homeAudit.includes('return second && !second.disabled'))
assert.ok(jewelryAudit.includes('return node && !node.disabled'))
assert.ok(jewelryAudit.includes('dialog.waitFor({state:"visible",timeout:15000})'))
console.log("HOMEPAGE_OCCASION_AND_JEWELRY_SORT_HYDRATION_GATES_PASSED: no dead SSR tap, real budget step after occasion selection, real visible modal")
