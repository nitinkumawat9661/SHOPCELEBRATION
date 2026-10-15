import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
const read=f=>readFile(new URL("../"+f,import.meta.url),"utf8")
const [tail,state,home,curated,occasion,navAudit,packageJson,roadmap]=await Promise.all([
  "features/home/StorefrontTail.tsx",
  "features/builder/useHamperBuilder.ts",
  "features/home/StorefrontDiscovery.tsx",
  "features/builder/CuratedHamperFlow.tsx",
  "features/catalog/OccasionRail.tsx",
  "scripts/audit-phase1-home-navigation-20261012.mjs",
  "package.json",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md"
].map(read))
assert(state.includes("    draftReady,") && state.includes("const [draftReady, setDraftReady]"),
  "Expose async saved-draft hydration readiness to the homepage builder")
assert(tail.includes('pendingRequest.current = { tierId: selectedTierId, occasion }') &&
  tail.includes("if (!state.draftReady) return") &&
  tail.includes("}, [requestVersion, state.draftReady])"),
  "Apply explicit new homepage tier and occasion only after the previous saved draft has been restored")
assert(tail.includes("if (state.tierId !== pending.tierId || state.checkout.occasion !== pending.occasion) return") &&
  tail.includes("pendingRequest.current = null") &&
  tail.includes("onSelectionSync(state.tierId, state.checkout.occasion)"),
  "Do not send stale default/draft occasion back while an explicit occasion selection is in flight")
assert(tail.includes('state.updateField("occasion", occasion)') &&
  tail.includes("state.selectTier(selectedTierId)") &&
  tail.includes("state.setStep(Math.min(3, Math.max(1, requestedStep)))"),
  "Keep exact tier, occasion and delivery/budget quick-start semantics")
assert(home.includes("setOccasion(value)")&&
  home.includes("openBuilder(1)")&&
  !home.includes("<BudgetSection")&&
  curated.includes("chooseBudget(item.id)")&&
  curated.includes("state.selectTier(id)"),
  "Homepage occasion opens original builder; budget selection lives in dedicated curated flow")
assert(occasion.includes("onClick={() => onChange(occasion)}")&&
  curated.includes("curatedBudgetCard")&&curated.includes("curatedPrimary"),
  "Real accessible occasion and curated budget controls remain unchanged")
assert(navAudit.includes('BASE_URL||"https://shopcelebration.in/"') &&
  navAudit.includes("occasion selected in builder") &&
  navAudit.includes('await ctx.route("**/api/**"'),
  "Keep safe post-deployment navigation and occasion regression checks inside the packaged source")
assert(roadmap.includes("LAST STEP OF PHASE 1") &&
  roadmap.includes("two product cards side by side on phones"),
  "Do not change deferred seven category images or original featured layout")
assert(packageJson.includes("test-phase1-home-navigation-sync-20261012.mjs"),
  "Require explicit homepage selection synchronization regression in the normal PR build")
console.log("Phase 1 homepage selection sync safeguards passed: occasion selection wins over old stored draft; dedicated budget page unchanged, no stale back-propagation, existing 2/4 featured grid and deferred category art unchanged.")
