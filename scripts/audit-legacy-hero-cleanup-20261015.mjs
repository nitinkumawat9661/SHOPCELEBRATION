#!/usr/bin/env node
/**
 * Phase-2 cleanup guard. The old heroClassicMotion CSS belongs to an abandoned
 * experimental hero, not the current Celebration photograph-based Hero.tsx.
 *
 * Check the entire application import/JSX tree, not just the homepage component.
 * No live route, payment, customer account or admin behaviour is changed.
 */
import assert from "node:assert/strict"
import { readFile, readdir, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..")
const dirs=["app","features","lib","config"]
const files=[]
const ext=/\.(?:tsx?|jsx?)$/
async function scan(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,item.name)
    if(item.isDirectory())await scan(file)
    else if(item.isFile()&&ext.test(item.name))files.push(file)
  }
}
for(const d of dirs) await scan(path.join(root,d))
const oldSelectors=["heroClassicMotion","heroPixelField","heroCardFloatMobile"]
const matches=[]
for(const file of files){
  const body=await readFile(file,"utf8")
  const used=oldSelectors.filter(selector=>body.includes(selector))
  if(used.length)matches.push({file:path.relative(root,file),selectors:used})
}
assert.deepEqual(matches,[],"An old hero animation class is still used in production JSX/JS")
const oldCss=path.join(root,"styles/hero-premium-v2.css")
assert.equal(await access(oldCss).then(()=>true,()=>false),false,
  "Delete the unreferenced experimental hero styles after confirming no markup uses them")
const globals=await readFile(path.join(root,"app/globals.css"),"utf8")
assert(!globals.includes('styles/hero-premium-v2.css'),
  "Drop only the obsolete hero-premium-v2.css global import")
assert(globals.includes('styles/live-hero-premium-20261015.css'),
  "Keep the verified live Celebration premium italic hero")
const hero=await readFile(path.join(root,"features/home/Hero.tsx"),"utf8")
assert(hero.includes('className="celebrationHero"')&&
  hero.includes('src="/images/campaign/hero-1600.webp"')&&
  hero.includes("Shop Hampers")&&hero.includes("Explore Jewelry"),
  "Live brand hero imagery and both CTAs remain present")
const curated=await readFile(path.join(root,"features/builder/CuratedHamperFlow.tsx"),"utf8")
const demo=await readFile(path.join(root,"features/builder/SelfBuildThreeScreenPreview.tsx"),"utf8")
assert(curated.includes("Review & Pay")&&demo.includes("Payment is not connected"),
  "Both existing hamper flows must be preserved")

console.log(JSON.stringify({
  status:"UNUSED_EXPERIMENTAL_HERO_REMOVED_SAFE",
  sourceFilesChecked:files.length,
  obsoleteClassesChecked:oldSelectors,
  originalLiveHeroProtected:true,
  curatedAndSelfBuildProtected:true
},null,2))
