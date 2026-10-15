#!/usr/bin/env node
/**
 * Retired CSS consolidation guard.
 * Scans runtime React/server source to prove the old warm/cream visual-card
 * hero no longer has consumers.  The actual photographed homepage and the
 * active trust strip, responsive header, curated and Self-Build routes remain.
 */
import assert from "node:assert/strict"
import { readdir, readFile, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const runtimeRoots = ["app", "features", "lib", "config", "components", "pages", "src"]
const retired = ["heroRefresh", "heroVisual", "heroShapeWaves", "heroLead", "heroItalic", "heroActions", "heroFacts"]
const files = []
async function walk(folder) {
  for (const entry of await readdir(folder, {withFileTypes:true})) {
    const f = path.join(folder, entry.name)
    if (entry.isDirectory()) await walk(f)
    else if (entry.isFile() && /\.(?:tsx?|jsx?)$/.test(entry.name)) files.push(f)
  }
}
for (const name of runtimeRoots) {
  const folder = path.join(root,name)
  if (await access(folder).then(()=>true,()=>false)) await walk(folder)
}
const callers = []
for (const file of files) {
  const content = await readFile(file, "utf8")
  const used = retired.filter(token => new RegExp("\\b"+token+"\\b").test(content))
  if (used.length) callers.push({file:path.relative(root,file),used})
}
assert.deepEqual(callers,[], "Legacy hero visual components still occur in active TS/TSX/JS sources")

const [refresh,perf,globals,hero,trust,curated,demo] = await Promise.all([
 "styles/home-refresh.css",
 "styles/performance-v2.css",
 "app/globals.css",
 "features/home/Hero.tsx",
 "features/shell/TrustStrip.tsx",
 "features/builder/CuratedHamperFlow.tsx",
 "features/builder/SelfBuildThreeScreenPreview.tsx"
].map(file=>readFile(path.join(root,file),"utf8")))

for (const t of retired) {
  assert(!new RegExp("\\."+t+"\\b").test(refresh), "Remove obsolete legacy CSS selector "+t)
}
assert(!refresh.includes("heroVisualBreath")&&!refresh.includes("mobileShapeWaveDrift"),
 "Old visual-card animations must be deleted")
assert(!perf.includes(".heroVisual{animation:none!important}"), "Remove redundant coarse-pointer visual-card override")

const activeSelectors=[
 ".trustStrip{", ".trustStripTrack{", "@keyframes trustStripMarquee",
 ".navin{", ".navAccountLink{", ".assistBarInner{", ".whatsappDock{",
 "#products,.proofReviewsSection,#builder{", ".footer .tiny{"
]
for (const selector of activeSelectors) assert(refresh.includes(selector), "Preserve active mobile / trust rule "+selector)
assert(globals.includes('@import "../styles/home-refresh.css";') &&
 globals.includes('@import "../styles/live-hero-premium-20261015.css";'),
 "Retain active storefront CSS and approved premium heading")
assert(hero.includes('className="celebrationHero"') && hero.includes("hero-1600.webp") &&
 hero.includes("Shop Hampers") && hero.includes("Explore Jewelry"),
 "Preserve approved photographic live hero and CTAs")
assert(trust.includes("trustStripTrack"), "Original service trust strip must remain functional")
assert(curated.includes("Review & Pay") && demo.includes("Payment is not connected"),
 "Curated checkout and explicitly non-transactional Self-Build demo remain safe")

console.log(JSON.stringify({
 status:"LEGACY_HOME_REFRESH_CLEANUP_SAFE",
 sourceFilesScanned:files.length,
 obsoleteSelectorsNotUsed:retired,
 preserved:["premium image hero","mobile nav","trust strip","responsive utilities","curated checkout","Self-Build design demo"]
},null,2))
