import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [styles, globals, header, cart, cards, filters, page, plan] = await Promise.all([
  read("styles/mobile-storefront-section6.css"),
  read("app/globals.css"),
  read("features/shell/StorefrontHeader.tsx"),
  read("features/cart/AddToCart.tsx"),
  read("features/catalog/CatalogCard.tsx"),
  read("features/catalog/JewelryMarketplaceFilters.tsx"),
  read("app/jewelry/[id]/page.tsx"),
  read("docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md")
])
const has = (regex, label) => assert.match(styles, regex, label)

assert(globals.includes('@import "../styles/mobile-storefront-section6.css";'), "Section 6 mobile CSS must be loaded")
assert(globals.indexOf('mobile-storefront-section6.css') > globals.indexOf('catalog-usability-audit.css'), "Mobile CSS must override the older condensed card styles")
assert(globals.indexOf('editorial-polish-section7.css') > globals.indexOf('mobile-storefront-section6.css'), "Editorial polish may follow only if it preserves mobile targets")
has(/@media\s*\(max-width:700px\)/, "Common phone-width layout not defined")
has(/@media\s*\(max-width:430px\)/, "Narrow phone fixed buy bar not defined")
has(/@media\s*\(max-width:360px\)/, "320px/360px compact layout not defined")

// Header: search remains visible and usable on iOS and every icon is a touch target.
assert(header.includes('className="celebrationSearch"') && header.includes('role="search"'), "Header search missing")
assert(header.includes('className="celebrationNav wrap"') && header.includes('aria-label="Store navigation"'), "Accessible navigation missing")
assert(header.includes("<CartLink />") && cart.includes('aria-label={`Shopping cart, ${cart.count} items`'), "Cart status must stay accessible")
has(/\.celebrationHeader \.celebrationIconLink\s*\{[^}]*min-width:44px;[^}]*min-height:44px;/s, "Header icon touch targets must be at least 44px")
has(/\.celebrationHeader \.celebrationSearch input\[type=search\]\s*\{[^}]*min-height:48px;[^}]*font-size:16px;/s, "Search must avoid Safari auto-zoom and provide a 48px field")
has(/\.celebrationHeader \.celebrationSearch button\s*\{[^}]*min-height:48px;/s, "Search submit target needs 48px")
has(/\.celebrationHeader \.celebrationNav\s*\{[^}]*overflow-x:auto;/s, "All navigation links must remain horizontally reachable")
has(/\.celebrationHeader \.celebrationNav a\s*\{[^}]*min-height:44px;/s, "Navigation links need 44px vertical targets")

// Cards must keep the product's exact long name, category, and real price visible.
assert(cards.includes("{product.name}") && cards.includes("product.salePricePaise"), "Original product identity and price controls must be preserved")
has(/\.collectionPage \.collectionGrid \.catalogCardCategory\s*\{[^}]*display:block;/s, "Do not hide category on narrow product cards")
has(/\.collectionPage \.collectionGrid \.catalogCard h3\s*\{[^}]*overflow:visible;[^}]*-webkit-line-clamp:unset;/s, "Product names must not be clipped to two lines")
has(/\.collectionPage \.collectionGrid \.catalogCardPrice>span:first-child\s*\{[^}]*display:block;/s, "Keep sale/stock status text on cards")
has(/@media\s*\(max-width:360px\)\s*\{[^]*?\.collectionPage \.collectionGrid\s*\{grid-template-columns:minmax\(0,1fr\);/s, "Small phones should not squeeze two product cards together")
has(/\.collectionPage \.collectionGrid \.catalogCard \.cartAddControl button\s*\{[^}]*min-height:44px;/s, "Add-to-cart must remain tappable")
has(/\.collectionPage \.collectionGrid \.catalogInlineQuantity button,\s*\.collectionPage \.collectionGrid \.catalogInlineQuantity output\s*\{[^}]*min-height:44px;/s, "Cart +/- controls must remain tappable")

// Filters, cart and fixed product buy bar should not collide at narrow widths.
assert(filters.includes('aria-modal="true"') && filters.includes('aria-label="Close"'), "Keep accessible filter sheet")
has(/\.collectionPage \.marketplaceFilterClear\s*\{min-height:44px!important;/s, "Clear-filters control must not shrink below 44px")
has(/\.collectionPage \.marketplaceFilterSheetHead>button\s*\{[^}]*width:44px;[^}]*height:44px;/s, "Filter dialog close button needs 44px")
has(/\.cartPage \.cartQuantity button,\.cartPage \.cartRemove\s*\{[^}]*min-height:44px;/s, "Cart +/- and remove controls need 44px")
has(/\.collectionPage \.mobileMarketplaceBuyBar>div:first-child\s*\{[^}]*grid-column:1\/-1;/s, "Narrow fixed buy bar must split price and purchasing rows")
has(/\.collectionPage \.mobileMarketplaceBuyBar \.catalogInlineQuantity\s*\{[^}]*grid-template-columns:44px minmax\(0,1fr\) 44px;/s, "Fixed buy bar +/- cannot shrink below 44px")
has(/\.collectionPage:has\(\.mobileMarketplaceBuyBar\) \.celebrationSupport\s*\{display:none\}/s, "Do not cover purchase buttons with WhatsApp support")
assert(page.includes("mobileMarketplaceBuyBar"), "Fixed mobile buy bar is expected on individual product pages")
assert(plan.includes("## Phase 1 — Homepage Redesign") && plan.includes("Verify the mobile header shows/hides without flicker on actual Android/iOS"), "Approved homepage plan must retain final real-device mobile visual acceptance")

// Catch accidental partial edits before the CSS reaches production.
assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length, "Unbalanced CSS blocks")
console.log("Section 6 mobile source checks passed: header, navigation, search, cart, filters, product identity, narrow buy bar, and 44px controls.")
