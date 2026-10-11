import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import vm from "node:vm"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [behavior, mobileCss, baseCss, globals, header, photo, oldGridTest] = await Promise.all([
  "features/shell/HeaderScrollBehavior.tsx",
  "styles/mobile-history-scroll-safety.css",
  "styles/jewelry-two-column-scroll-header-fix.css",
  "app/globals.css",
  "features/shell/StorefrontHeader.tsx",
  "features/catalog/ProductGallery.tsx",
  "scripts/test-catalog-source-name-and-mobile-grid.mjs"
].map(read))

assert(mobileCss.includes("overscroll-behavior-x:none"), "Block Chrome history gestures from horizontal viewport overscroll")
assert(/html,body\s*\{[^}]*overscroll-behavior-x:none;/s.test(mobileCss),
  "Apply history-overscroll containment to the actual viewport roots")
assert(mobileCss.includes("overflow-anchor:none"), "Disallow sticky header as a scroll-anchoring target")
assert(mobileCss.includes("touch-action:pan-y"), "Product-image vertical page scrolling must remain available")
assert(!/html,body\s*\{[^}]*touch-action:/s.test(mobileCss), "Do not break inner horizontal product/category rails")
assert(globals.includes('@import "../styles/mobile-history-scroll-safety.css";'), "The new mobile scroll guards must be loaded")
assert(globals.trim().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Previous last-in-cascade two-column jewelry grid contract must remain")
assert(baseCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "Do not undo the two parallel jewelry cards")
assert(header.includes("<HeaderScrollBehavior />"), "Mobile collapse remains mounted")
assert(photo.includes("onTouchStart={startSwipe}") && photo.includes("onTouchEnd={endSwipe}"),
  "Existing product gallery swipe input remains in place")
assert(!/location\.assign|history\.back|history\.forward|router\.push/i.test(behavior),
  "Collapsing the header must never navigate to another page")

// Execute the ACTUAL TSX header listener code with simulated mobile scroll
// input. This reproduces a collapse-induced upward scrollY jump; it must not
// reopen the menu until an explicit upward gesture is received.
const js = ts.transpileModule(behavior, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX
  }
}).outputText

class FakeElement {
  constructor() { this.attrs = new Map(); this.listeners = new Map(); this.inert = false }
  addEventListener(name, fn) { this.listeners.set(name, fn) }
  removeEventListener(name) { this.listeners.delete(name) }
  setAttribute(name, value) { this.attrs.set(name, value) }
  getAttribute(name) { return this.attrs.get(name) || null }
  removeAttribute(name) { this.attrs.delete(name) }
  contains(item) { return item === this || item === nav || item === search }
  querySelector(name) { return name === ".celebrationNav" ? nav : name === ".celebrationSearch" ? search : null }
}
const headerEl = new FakeElement()
const nav = new FakeElement()
const search = new FakeElement()
let now = 1000
let rafId = 0
const raf = new Map()
let onCleanup = null
const mobile = { matches:true, listeners:new Map(), addEventListener(n,f){this.listeners.set(n,f)},removeEventListener(n){this.listeners.delete(n)} }
const win = {
  scrollY:240, listeners:new Map(),
  matchMedia:()=>mobile,
  addEventListener(n,f){this.listeners.set(n,f)},
  removeEventListener(n){this.listeners.delete(n)},
  requestAnimationFrame(cb){const id=++rafId;raf.set(id,cb);return id},
  cancelAnimationFrame(id){raf.delete(id)}
}
const doc = {
  activeElement:null, listeners:new Map(),
  querySelector:()=>headerEl,
  addEventListener(n,f){this.listeners.set(n,f)},
  removeEventListener(n){this.listeners.delete(n)}
}
const mockReact = {useEffect:fn=>{onCleanup=fn()}}
const exportsRef={}
vm.runInNewContext(js, {
  exports:exportsRef, require:id=>{assert.equal(id,"react");return mockReact},
  window:win, document:doc, performance:{now:()=>now},HTMLElement:FakeElement,
  Math,Set
})
exportsRef.HeaderScrollBehavior()
function scrollTo(y){
  win.scrollY=y
  const listener=win.listeners.get("scroll")
  assert(listener,"Scroll handler must be installed")
  listener()
  for(const [id,callback] of raf){raf.delete(id);callback()}
}
function swipe({fromX=120,fromY=220,toX=120,toY=160}={}){
  const t=(x,y)=>({touches:[{clientX:x,clientY:y}]})
  doc.listeners.get("touchstart")(t(fromX,fromY))
  doc.listeners.get("touchmove")(t(toX,toY))
}
assert.equal(headerEl.getAttribute("data-compact-nav"),null, "At mount, header is not collapsed")
scrollTo(280)
assert.notEqual(headerEl.getAttribute("data-compact-nav"),"true", "Non-user scroll anchoring must not collapse header")
swipe()
scrollTo(320)
assert.equal(headerEl.getAttribute("data-compact-nav"),"true", "User down-swipe collapses oversized mobile nav")
assert.equal(nav.inert,true,"Hidden nav cannot capture links/tabs")
assert.equal(search.inert,true,"Hidden search cannot capture focus")
// Collapsing the sticky header can reduce document height and make scrollY
// jump backward. This is NOT a user swipe up and must not reopen the header.
scrollTo(200)
assert.equal(headerEl.getAttribute("data-compact-nav"),"true", "Layout-induced upward scroll must not oscillate the header")
swipe({fromX:100,fromY:210,toX:250,toY:208})
scrollTo(190)
assert.equal(headerEl.getAttribute("data-compact-nav"),"true", "Horizontal image swipes must not restore the header")
swipe({fromY:200,toY:265})
scrollTo(170)
assert.equal(headerEl.getAttribute("data-compact-nav"),"false", "True up-swipe restores header")
assert.equal(nav.inert,false)
assert.equal(search.inert,false)
swipe()
scrollTo(250)
assert.equal(headerEl.getAttribute("data-compact-nav"),"true")
now+=1000
scrollTo(220)
assert.equal(headerEl.getAttribute("data-compact-nav"),"true", "Expired gesture cannot flip header via viewport reflow")
scrollTo(60)
assert.equal(headerEl.getAttribute("data-compact-nav"),"false", "Near page top always show nav")
assert.equal(typeof onCleanup,"function")
onCleanup()
assert.equal(win.listeners.size,0,"Unsubscribes browser handlers on page switch")
assert.equal(doc.listeners.size,0,"Unsubscribes touch and keyboard handlers")
assert.equal(mobile.listeners.size,0,"Unsubscribes viewport handler")
console.log("Mobile page stability passed: root history-overscroll prevention, 2-column jewelry grid, true touch collapse/restore, horizontal gesture isolation, and no scroll-anchoring oscillation.")
