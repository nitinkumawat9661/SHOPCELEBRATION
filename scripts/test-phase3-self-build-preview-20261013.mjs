import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = path => readFile(new URL("../"+path, import.meta.url), "utf8")
const [page, projection, ui, css, admin, docs, currentDb] = await Promise.all([
  "app/admin/self-build-preview/page.tsx",
  "lib/server/self-build-preview.ts",
  "features/builder/SelfBuildDesignPreview.tsx",
  "styles/self-build-preview-20261013.css",
  "features/admin/AdminDashboard.tsx",
  "docs/CELEBRATION_COMPLETE_PROGRESS_AND_NEXT_STEPS_20261013.md",
  "db/migrations/049_self_build_category_only_no_sku_mapping.sql"
].map(read))
assert(page.includes('if (!await isAdminRequest())'),"Render preview only after verified admin auth")
assert(page.indexOf('if (!await isAdminRequest())') < page.indexOf('getSelfBuildVisualData()'),"No private DB reads before access check")
assert(page.includes('robots: { index: false, follow: false }'),"Admin preview must be noindex")
assert(page.includes('export const dynamic = "force-dynamic"'))
assert(page.includes('SelfBuildDesignPreview data={data}'))
assert(page.includes('self-build-preview-20261013.css'))
assert(!/getSelfBuildAdminState|unitBudgetPaise|productRules/.test(page),"Route must pass sanitized visual data only")
assert(projection.includes('getSelfBuildAdminState()'),"Use live admin DB categories, not static client seed")
assert(projection.includes('categories: visible.map(item => ({'))
assert(projection.includes('options: state.options.filter(item => item.active'))
assert(projection.includes('item.parentId === null || allActive.has(item.parentId)'),"Inactive parent options must not render")
const whitelist=projection.match(/categories: visible\.map\(item => \(\{([\s\S]*?)\}\)\)/)?.[1]||""
const optionWhitelist=projection.match(/options: state\.options\.filter[\s\S]*?\.map\(item => \(\{([\s\S]*?)\}\)\)/)?.[1]||""
assert(whitelist.includes("id: item.id")&&whitelist.includes("label: item.label")&&whitelist.includes("selectionKind: item.selectionKind"))
assert(optionWhitelist.includes("id: item.id")&&optionWhitelist.includes("label: item.label"))
for(const restricted of ["unitBudgetPaise","salePricePaise","defaultCatalogItemBudgetPaise","price","stock","productId","productRules","catalogCategory"]) {
  assert(!whitelist.includes(restricted),"Private/property leaked in category visual data: "+restricted)
  assert(!optionWhitelist.includes(restricted),"Private/property leaked in option visual data: "+restricted)
}
assert(ui.startsWith('"use client"'))
assert(ui.includes('data.categories')&&ui.includes('data.options'),"UI must be data-driven from DB")
assert(!ui.includes("Premium Feature Necklaces")&&!ui.includes("chocolate-extra-100")&&!ui.includes("viral-bangles"),"No hardcoded DB category names or IDs")
assert(!/unitBudgetPaise|totalInternalBudget|catalog_config|ProductStep|selectedProductIds|fetch\(|window\.open|\/api\/payments|\/api\/orders/.test(ui),"UI must not use private prices, retail SKUs or call checkout")
assert(ui.includes('function QuantityControl')&&ui.includes('Add one')&&ui.includes('Remove one')&&ui.includes('aria-live="polite"'))
assert(ui.includes('setQuantities')&&ui.includes('Math.max(0, count - 1)'),"Quantity controls must support multi-selection")
assert(ui.includes('sortedCategories.filter(item => item.parentId === (openId ?? null)')&&ui.includes('setOpenId(category.id)'),"Category-first navigation required")
assert(ui.includes('category.selectionKind === "group" || category.selectionKind === "variant"'))
assert(ui.includes('currentCategory?.selectionKind === "variant"')&&ui.includes("childOptions.map"))
assert(ui.includes('category.selectionKind === "photo"')&&ui.includes('category:${category.id}'),"Photos must have quantity control")
assert(ui.includes('data.requestPrompt')&&ui.includes('maxLength={1200}'),"Admin text prompt must be rendered and bounded")
assert(ui.includes('const units = chosen.reduce')&&ui.includes('const distinct = chosen.length'))
assert(ui.includes('disabled={units === 0}'),"Require at least one selection to proceed")
assert(ui.includes('Design preview only')&&ui.includes('No order, quote or payment is created'),"Preview must not simulate order submission")
assert(ui.includes('celebration')&&ui.includes('Thoughtfully chosen.')&&ui.includes('Beautifully yours.'))
assert(ui.includes('aria-label="Your hamper preview summary"')&&ui.includes('aria-label="Hamper design steps"'))
assert(css.includes('.sbPreviewPage{')&&css.includes('--sb-serif:')&&css.includes('var(--font-shopping-display)'),"Use Celebration typography")
assert(css.includes('@media (max-width:520px)')&&css.includes('@media (max-width:360px)'))
assert(css.includes('@media (max-width:780px)')&&css.includes('prefers-reduced-motion'))
assert(css.includes(':focus-visible')&&css.includes('min-height:51px')&&css.includes('min-height:44px'),"Keyboard focus & touch targets")
assert(!/url\(http|animation:.*infinite/.test(css),"No remote assets/autoplay scrolling")
assert(admin.includes('href="/admin/self-build-preview"'),"Make review reachable from admin UI")
assert(docs.includes('Consolidated Project Progress')&&docs.includes('Phase 3.7')&&docs.includes('NO SKU'),"Roadmap document must exist before UI")
assert(currentDb.includes("DROP TABLE self_build_catalog_product_rules"),"SKU mapping must remain absent")
console.log("Phase 3 minimalist self-build preview contracts passed: admin authentication, dynamic whitelist data, zero leaked internal budgets, category-only quantity UI, responsive/accessibility safeguards, no ordering.")
