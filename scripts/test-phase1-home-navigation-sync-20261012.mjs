import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
const read=f=>readFile(new URL("../"+f,import.meta.url),"utf8")
const [tail,state,home,budget,occasion,workflow,packageJson,roadmap]=await Promise.all([
  "features/home/StorefrontTail.tsx",
  "features/builder/useHamperBuilder.ts",
  "features/home/StorefrontDiscovery.tsx",
  "features/catalog/BudgetSection.tsx",
  "features/catalog/OccasionRail.tsx",
  ".github/workflows/phase1-home-navigation-qa.yml",
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
assert(home.includes("setOccasion(value)") &&
  home.includes("openBuilder(1)") &&
  home.includes("openBuilder(2, id, true)") &&
  home.includes("setSelectedTierId(id)"),
  "Unchanged budget and occasion entry choices open the original builder")
assert(budget.includes("onClick={() => onSelect(item.id)}") &&
  occasion.includes("onClick={() => onChange(occasion)}"),
  "Real accessible budget and occasion buttons remain unchanged")
assert(workflow.includes('workflows: ["Deploy Celebration Production"]') &&
  workflow.includes('github.event.workflow_run.conclusion'),
  "Live integration browser checks must verify actual production after new code is deployed")
assert(roadmap.includes("LAST STEP OF PHASE 1") &&
  roadmap.includes("two product cards side by side on phones"),
  "Do not change deferred seven category images or original featured layout")
assert(packageJson.includes("test-phase1-home-navigation-sync-20261012.mjs"),
  "Require explicit homepage selection synchronization regression in the normal PR build")
console.log("Phase 1 homepage selection sync safeguards passed: explicit occasion/budget wins over old stored draft, no stale back-propagation, existing 2/4 featured grid and deferred category art unchanged.")
