import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")
const [header, oldMobile, finalMobile, globalCss, cart, plan, originalStyle] = await Promise.all([
  "features/shell/StorefrontHeader.tsx",
  "styles/mobile-storefront-section6.css",
  "styles/mobile-navigation-final-task4.css",
  "app/globals.css",
  "features/cart/AddToCart.tsx",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md",
  "styles/celebration.css"
].map(read))

const has = (regex, why) => assert.match(finalMobile, regex, why)
assert(header.includes('className="celebrationNav wrap"') && header.includes('aria-label="Store navigation"'), "Preserve semantic nav landmarks")
assert(header.includes('<CartLink />') && header.includes('className="celebrationSearch"'), "Keep cart and search in native header")

const navStart = header.indexOf("<nav className=\"celebrationNav wrap\"")
const navEnd = header.indexOf("</nav>", navStart)
assert(navStart !== -1 && navEnd !== -1, "Find store navigation source")
const nav = header.slice(navStart, navEnd)
const linkLabels = Array.from(nav.matchAll(/>(Hampers|Jewelry|All Gifts|Occasions|Budget|Why Celebration)</g), m=>m[1])
assert.deepEqual(linkLabels, ["Hampers","Jewelry","All Gifts","Occasions","Budget","Why Celebration"], "All six real nav destinations must be preserved")
for(const anchor of ['/\#budgets','/jewelry','/jewelry?view=all','/\#occasions','/\#trust']) {
  assert(nav.includes(anchor.replaceAll("\\","")), `Missing navigation destination: ${anchor}`)
}
assert(!/Budg\b/.test(nav.replaceAll("Budget","")), "No truncated Budget text")

// All six links are laid out simultaneously, with two complete rows on
// 320/360/375/390/430px and one row on wider 541–700px devices.
// Their full labels can wrap inside a 44px-minimum link, unlike the old
// overflowing strip where part of the next word was outside the viewport.
has(/@media\(max-width:700px\)/, "Mobile responsive entrypoint must exist")
has(/\.celebrationHeader \.celebrationNav\s*\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\);/s, "Use six equal visible nav columns on wide phones")
has(/@media\(max-width:540px\)\s*\{\s*\.celebrationHeader \.celebrationNav\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/s, "Use fully visible three-column/two-row nav at 320–430px")
has(/\.celebrationHeader \.celebrationNav a\s*\{[^}]*min-height:44px;[^}]*white-space:normal;[^}]*overflow:visible;[^}]*text-overflow:clip;[^}]*text-align:center;/s, "Keep labels readable, never cut or ellipsized")
has(/\.celebrationHeader \.celebrationNav\s*\{[^}]*overflow:visible;[^}]*scroll-snap-type:none;/s, "Full nav must not hide partial labels in horizontal scroll")
has(/@media\(max-width:360px\)/, "320px accommodations required")
has(/\.celebrationHeader \.celebrationNav a:focus-visible/, "Keyboard focus on nav must be visible")

// Preserve the original mobile protections for cart, search and account.
has(/\.celebrationHeader \.celebrationHeaderTop\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto;/s, "Compact non-overlapping brand/actions columns required")
has(/\.celebrationHeader \.celebrationIconLink\s*\{[^}]*min-width:44px;[^}]*min-height:44px;/s, "Account, hamper and cart icon links need 44px targets")
has(/\.celebrationHeader \.celebrationIconLink svg\s*\{[^}]*width:36px;[^}]*height:36px;/s, "Even icon sizes required")
has(/\.celebrationHeader \.celebrationCartLink \.cartCount\s*\{[^}]*top:0;[^}]*right:0;/s, "Cart count cannot cover other controls")
has(/\.celebrationHeader \.celebrationSearch\s*\{[^}]*grid-column:1\/-1;[^}]*width:100%;/s, "Mobile search must use full row without overlap")
has(/\.celebrationHeader \.celebrationSearch input\[type=search\]\s*\{[^}]*min-height:48px;[^}]*font-size:16px;/s, "iOS search prevents zoom and needs 48px height")
has(/\.celebrationHeader \.celebrationSearch button\s*\{[^}]*width:48px;[^}]*min-height:48px;/s, "Search icon must remain 48px wide/tall")
assert(header.includes('role="search"') && header.includes('aria-label="Search gifts"'), "Search must remain labelled")
assert(cart.includes('aria-label={`Shopping cart, ${cart.count} items`') && cart.includes("cartCount"), "Dynamic accessible cart count must remain")
assert(oldMobile.includes("min-height:44px") && oldMobile.includes("scroll-snap-type:x proximity"), "Old Section 6 safeguard remains, final CSS deliberately overrides nav scroll only")
assert(originalStyle.includes(".celebrationHeader{position:sticky"), "Sticky header behavior must remain")
has(/scroll-margin-top:235px;/, "In-page anchors must clear the taller mobile header")
assert(globalCss.includes('@import "../styles/mobile-navigation-final-task4.css";') && globalCss.indexOf("mobile-navigation-final-task4.css") > globalCss.indexOf("mobile-storefront-section6.css"), "Final navigation CSS must override the older responsive header rules")
assert(globalCss.indexOf("homepage-human-rhythm-task5.css") > globalCss.indexOf("mobile-navigation-final-task4.css"), "Later homepage-only styles must not supersede navbar rules")
assert(plan.includes("## Phase 1 — Homepage Redesign"), "Approved competitor homepage plan must preserve mobile navigation")
assert.equal((finalMobile.match(/\{/g)||[]).length,(finalMobile.match(/\}/g)||[]).length,"Malformed mobile CSS block delimiters")

console.log("Task 4 mobile navigation code checks passed: six visible links, 3x2 grid on 320–430px, 44px account/cart/link targets, full-width 48px search, Safari text sizing and keyboard focus.")
