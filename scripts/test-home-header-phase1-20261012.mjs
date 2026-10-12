import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8")
const [home,header,controller,css,globals,featured,category,media,roadmap,packageRaw]=await Promise.all([
  "features/home/Storefront.tsx",
  "features/shell/StorefrontHeader.tsx",
  "features/shell/HeaderScrollBehavior.tsx",
  "styles/home-mobile-header-compact-stable-20261012.css",
  "app/globals.css",
  "styles/home-phase1-original-featured-grid-20261012.css",
  "styles/home-category-real-detail-v5.css",
  "scripts/install-owner-category-art-v6.mjs",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md",
  "package.json"
].map(read))
assert(home.includes('<StorefrontHeader settings={initialSettings} />') &&
  home.includes('className="celebrationHomeHeaderSpacer"'),
  "Homepage enables a single shared controller and reserves natural header space")
assert(!home.includes("stableOnHome") && !header.includes("stableOnHome") &&
  header.includes("<HeaderScrollBehavior />"),
  "Mobile navigation controller must be mounted on homepage as well as other pages")
assert(controller.includes('const homeSpacer = document.querySelector<HTMLElement>(".celebrationHomeHeaderSpacer")') &&
  !controller.includes("new ResizeObserver(") &&
  controller.includes("expandedHeight - height") &&
  controller.includes("width === previousViewportWidth"),
  "Only measure on state/breakpoint changes, never on mobile toolbar height-only resize")
assert(controller.includes('if (nav) nav.inert = value') &&
  controller.includes('if (search) search.inert = value') &&
  controller.includes('window.addEventListener("resize", onViewportChange') &&
  controller.includes('window.removeEventListener("resize", onViewportChange)'),
  "Collapsed search/nav must be inaccessible to tabbing and listeners must clean up")
assert(controller.includes('Math.abs(dy) > Math.abs(dx) * 1.2') &&
  controller.includes("const fromUser = gestureDirection") &&
  controller.includes("performance.now() - gestureAt < 900") &&
  controller.includes("focusedInHeader"),
  "Only real user vertical navigation may collapse/reopen; ignore horizontal rail gestures and layout changes")
assert(css.includes(".celebrationHome .celebrationHeader") &&
  css.includes("position:sticky") &&
  css.includes("overflow-anchor:none") &&
  css.includes(".celebrationHome .celebrationHomeHeaderSpacer") &&
  css.includes("pointer-events:none") &&
  css.includes("@media(max-width:700px)"),
  "Homepage has sticky compact navigation with zero-interaction layout spacer")
assert(css.includes("transition:none!important") &&
  css.includes(".celebrationHome .celebrationHeader .celebrationNav") &&
  css.includes(".celebrationHome .celebrationHeader .celebrationSearch"),
  "Homepage nav and search must switch without costly max-height/opacity animation")
assert(!css.includes(".celebrationCategories") &&
  !css.includes(".celebrationFeatured") &&
  !css.includes(".collectionPage") &&
  !css.includes(".cartPage"),
  "Do not change category circles, featured grid, listing, cart or checkout")
assert(globals.includes('@import "../styles/home-mobile-header-compact-stable-20261012.css";') &&
  globals.indexOf("home-mobile-header-compact-stable-20261012.css") >
    globals.indexOf("home-category-compact-stable-20261012.css") &&
  globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "New homepage sticky override loads after old non-sticky styling but before protected final listing CSS")
assert(featured.includes("grid-template-columns:repeat(2,minmax(0,1fr))") &&
  featured.includes("grid-template-columns:repeat(4,minmax(0,1fr))"),
  "Owner's last-approved original featured grid must remain")
assert(category.includes(".celebrationCategories .celebrationCategoryEditorialPhoto") &&
  media.includes("catalog/editorial/category-v6/") &&
  roadmap.includes("LAST STEP OF PHASE 1"),
  "Keep all seven round category images untouched until last Phase 1 step")

// Execute the real TypeScript controller with a fake mobile browser. We
// simulate its layout box shrinking when CSS [data-compact-nav] changes.
class FakeEl {
  constructor(){this.attrs=new Map();this.listeners=new Map();this.inert=false;this.style={height:"0px"}}
  addEventListener(n,fn){this.listeners.set(n,fn)}
  removeEventListener(n){this.listeners.delete(n)}
  setAttribute(n,v){this.attrs.set(n,v)}
  removeAttribute(n){this.attrs.delete(n)}
  getAttribute(n){return this.attrs.get(n)||null}
  contains(e){return e===this||e===nav||e===search}
  querySelector(sel){return sel===".celebrationNav"?nav:sel===".celebrationSearch"?search:null}
  getBoundingClientRect(){this.layoutReads=(this.layoutReads||0)+1;return{height:this.getAttribute("data-compact-nav")==="true"?62:215}}
}
const mainHeader=new FakeEl(),nav=new FakeEl(),search=new FakeEl(),spacer=new FakeEl()
let now=1000,frame=0,cleanup
const frames=new Map()
const mql={matches:true,handlers:new Map(),addEventListener(n,fn){this.handlers.set(n,fn)},removeEventListener(n){this.handlers.delete(n)}}
const win={
  scrollY:50,innerWidth:390,handlers:new Map(),
  matchMedia:()=>mql,
  addEventListener(n,fn){this.handlers.set(n,fn)},
  removeEventListener(n){this.handlers.delete(n)},
  requestAnimationFrame(fn){frames.set(++frame,fn);return frame},
  cancelAnimationFrame(id){frames.delete(id)}
}
const doc={
  activeElement:null,handlers:new Map(),
  querySelector(sel){return sel===".celebrationHeader"?mainHeader:sel===".celebrationHomeHeaderSpacer"?spacer:null},
  addEventListener(n,fn){this.handlers.set(n,fn)},
  removeEventListener(n){this.handlers.delete(n)}
}
const output=ts.transpileModule(controller,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX
}}).outputText
const exp={}
vm.runInNewContext(output,{
  exports:exp,require:n=>{assert.equal(n,"react");return{useEffect:fn=>{cleanup=fn()}}},
  document:doc,window:win,HTMLElement:FakeEl,
  performance:{now:()=>now},Math,Set
})
exp.HeaderScrollBehavior()
const scrollTo=y=>{
  win.scrollY=y
  win.handlers.get("scroll")()
  for(const [id,fn] of frames){frames.delete(id);fn()}
}
const touch=(x1,y1,x2,y2)=>{
  const t=(x,y)=>({touches:[{clientX:x,clientY:y}]})
  doc.handlers.get("touchstart")(t(x1,y1))
  doc.handlers.get("touchmove")(t(x2,y2))
}
const total=()=>mainHeader.getBoundingClientRect().height+Number.parseFloat(spacer.style.height)
assert.equal(spacer.style.height,"0px","At the top the natural header must be expanded")
assert.equal(total(),215,"Full header occupies exact natural space")
scrollTo(260)
assert.notEqual(mainHeader.getAttribute("data-compact-nav"),"true","Programmatic page jump does not fold header")
touch(100,250,100,170)
scrollTo(330)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true","True downward swipe folds large search/navigation")
assert.equal(nav.inert,true)
assert.equal(search.inert,true)
assert.equal(spacer.style.height,"153px","Flow spacer compensates precise 153px lost height")
assert.equal(total(),215,"Page document height must not change on mobile fold")
// Mobile address-bar reveal/hide fires window.resize with only HEIGHT changing.
// It must not reopen nav, re-measure the header or shift the spacer.
const readsBeforeToolbarResize=mainHeader.layoutReads
for(let i=0;i<8;i++) win.handlers.get("resize")()
assert.equal(mainHeader.layoutReads,readsBeforeToolbarResize,
  "Mobile toolbar height-only resize must not re-measure the sticky header")
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true",
  "Mobile toolbar height-only resize must not reopen the navigation")
assert.equal(total(),215,"Toolbar height changes preserve document flow")
scrollTo(270)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true","Layout jump cannot expand header without real upward gesture")
touch(100,250,250,248)
scrollTo(250)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true","Horizontal category swipe must not reopen header")
touch(90,170,90,250)
scrollTo(220)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"false","True upward swipe expands search/navigation")
assert.equal(nav.inert,false)
assert.equal(search.inert,false)
assert.equal(total(),215,"Restore full header without document jump")
touch(100,250,100,175)
scrollTo(330)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true")
now+=1000
scrollTo(280)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"true","Expired gestures must be ignored")
scrollTo(55)
assert.equal(mainHeader.getAttribute("data-compact-nav"),"false","At the top full navigation is visible")
mql.matches=false
win.handlers.get("resize")()
assert.equal(spacer.style.height,"0px","Desktop viewport disables homepage flow spacer")
assert.equal(mainHeader.getAttribute("data-compact-nav"),"false","Desktop never has compact mobile nav")
assert.equal(typeof cleanup,"function")
cleanup()
assert.equal(win.handlers.size,0)
assert.equal(doc.handlers.size,0)
assert.equal(mql.handlers.size,0)
assert.equal(spacer.style.height,"0px")
assert(packageRaw.includes("test-home-header-phase1-20261012.mjs"),
  "Protect home mobile scroll restoration on all PR/release builds")
console.log("Phase 1 mobile homepage header passed: one-shot collapse/expand, constant flow, no resize observer, no toolbar-resize remeasure, mobile and desktop lifecycle cleanup.")
