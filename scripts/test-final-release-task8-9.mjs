import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [gallery, styling, stylingComponent, finishCss, globals, mobile, header, card, filterSheet, detail, home, reviews, orderProof, sourceMapRaw, productsRaw, plan, previousTests, productStyles] = await Promise.all([
  "features/catalog/ProductGallery.tsx",
  "lib/domain/product-styling.ts",
  "features/catalog/ProductHowToStyle.tsx",
  "styles/storefront-final-finish-task8.css",
  "app/globals.css",
  "styles/mobile-storefront-section6.css",
  "features/shell/StorefrontHeader.tsx",
  "features/catalog/CatalogCard.tsx",
  "features/catalog/JewelryMarketplaceFilters.tsx",
  "app/jewelry/[id]/page.tsx",
  "features/home/Storefront.tsx",
  "features/catalog/ProductReviews.tsx",
  "lib/domain/real-social-proof.ts",
  "content/catalog-image-source-map.json",
  "content/catalog.json",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md",
  "scripts/test-final-storefront.mjs",
  "styles/product-styling.css"
].map(read))

const catalog = JSON.parse(productsRaw).products
const sources = JSON.parse(sourceMapRaw).products
assert.equal(catalog.length,89,"Do not lose any verified seed SKU")
assert.equal(new Set(catalog.map(p=>p.id)).size,89,"Do not duplicate SKU IDs")
const allowed = new Set([
  "Necklace + Earrings Sets", "Premium Anti-Tarnish Necklaces", "Trending Necklaces",
  "Gold-Plated Bangles & Bracelets", "Adjustable Rings"
])
const counts = Object.create(null)
for(const p of catalog){
  assert(allowed.has(p.category),`Unexpected category needs manual style validation: ${p.id}`)
  counts[p.category] = (counts[p.category]||0)+1
  assert.equal(p.imageUrl,p.images?.[0]?.url,`Card and detail SKU/photo ownership mismatch: ${p.id}`)
  if(p.imageUrl.startsWith("/api/catalog/image?key=")){
    assert(sources[p.id],`Rehosted photo must retain original same-product source provenance: ${p.id}`)
  }else{
    assert(p.imageUrl.startsWith("https://shopcelebration.in/catalog/necklaces/"),`Unknown photo requires manual signoff: ${p.id}`)
  }
}
assert.equal(Object.keys(counts).length,5,"All five actual seed categories need safe style advice")
assert.equal(Object.keys(sources).length,67,"Original 67 verified backup photo records retained")

// Category truth and accessible labels.
for(const label of ["set","necklace","earrings","ring","wristwear","gift"]){
  assert(styling.includes(`categoryKind: "${label}"`),`Missing category guidance: ${label}`)
}
assert(styling.includes('const source = category || name'),"Category must override potentially misleading titles")
assert(styling.includes('heading: "Gift ideas"'),"Unfamiliar gift categories must never get jewelry instructions")
assert(styling.includes("together") && styling.includes("separately"),"Sets must explain both wearing choices")
assert(!/\b(?:100% waterproof|guaranteed forever|genuine diamond)\b/i.test(styling),"No invented quality claims")
assert(stylingComponent.includes('advice.categoryKind === "gift"'),"Copy label must distinguish gifts from jewelry")
assert(productStyles.includes("@media(max-width:750px)"),"Styling advice must reflow on phones")

// Product gallery safety: only genuine supplied photos, horizontal gestures
// that ignore vertical page movement, 44px buttons, keyboard and live count.
assert(gallery.includes("productImages(product)") && gallery.includes('images.length > 1'),"Never fabricate other photo angles")
assert(gallery.includes("const dx =") && gallery.includes("const dy =") &&
  gallery.includes("Math.abs(dx) >= 55") && gallery.includes("Math.abs(dx) > Math.abs(dy) * 1.5"),
  "Only intentional horizontal swipes must change the image")
assert(gallery.includes('event.key === "ArrowRight"') && gallery.includes('"ArrowLeft"'),"Allow keyboard arrow navigation")
assert(gallery.includes('onTouchCancel={() => { touchStart.current = null }}'),"Cancel previous swipe data")
assert(gallery.includes('aria-live="polite"') && gallery.includes('aria-pressed={index === active}'),"Announce and highlight selected photo")
assert(gallery.includes('key={`${product.id}:${current.url}`}'),"Switch image state safely with same-SKU URL")
assert(finishCss.includes("touch-action:pan-y"),"Allow page vertical scrolling through the gallery")
assert(finishCss.includes(".marketplaceGalleryStage:focus-visible"),"Keyboard users need visible focus")

// Preserve buyer controls and real commerce architecture on mobile.
for(const required of [
  ".marketplaceGalleryArrow", ".marketplaceGalleryThumbs button",
  ".mobileMarketplaceBuyBar", ".marketplaceFilterSheet",
  ".marketplaceFilterOptions button", "env(safe-area-inset-bottom",
  "prefers-reduced-motion", ".catalogCard"
])assert(finishCss.includes(required),`Missing final detail polish: ${required}`)
assert(finishCss.includes("min-width:44px") && finishCss.includes("min-height:48px"),
  "44/48px mobile touch targets must be maintained")
assert(mobile.includes("min-height:44px") && mobile.includes("grid-template-columns:minmax(44px"),
  "Previous mobile protections must remain")
assert(header.includes('aria-label="Store navigation"') && header.includes('<CartLink />'),
  "Search, account and cart navigation must remain")
assert(filterSheet.includes('role="dialog"') && filterSheet.includes('event.key === "Escape"') &&
  filterSheet.includes("document.body.style.overflow = \"hidden\""),
  "Mobile filter overlay must trap focus, close by Escape and lock scrolling")
assert(card.includes("CatalogProductImage product={product}"),"Cards must use exact SKU photographs")
assert(detail.includes("<ProductGallery product={product} />") && detail.includes("<AddToCart"),
  "Product page must retain gallery and real purchase actions")
assert(reviews.includes("Be the first to review this product"),"Keep genuine no-review state")
assert(orderProof.includes("isPublicHamperOrderProof"),"Never add fake proof")
assert(home.includes("isPublicHamperOrderProof(initialSocialProof, tiers)") && home.includes("initialSocialProof={visibleProof}"),
  "Homepage only forwards verified paid and delivered proof for budget badges")

// CSS order: final finish must not override header navigation, and touches
// only public/customer facing page scopes. Existing font binaries stay local.
assert(globals.indexOf("storefront-final-finish-task8.css") > globals.indexOf("real-social-proof-task6.css"),
  "Task 8 final scoped CSS should be applied after older presentation rules")
assert(!finishCss.includes(".adminPage") && !finishCss.includes(".checkoutPage"),"Do not restyle operational flows")
assert(!finishCss.includes("display:none!important"),"Do not hide details as a finishing shortcut")
assert((finishCss.match(/\{/g)||[]).length === (finishCss.match(/\}/g)||[]).length,
  "Finish stylesheet brackets must balance")

const fakePhrases=[/powered by ai/i,/lorem ipsum/i,/dummy review/i,/sample testimonial/i,/insert your text here/i]
for(const source of [await read("features/home/Hero.tsx"),await read("features/home/HomeCatalog.tsx"),header,card,detail,home]){
 for(const p of fakePhrases) assert(!p.test(source),`Customer surface contains placeholder text: ${p}`)
}
assert(previousTests.includes('await visit(new URL("features/", root).pathname)'),
  "Keep existing broad customer TSX/json filler scan")
assert(plan.includes("## Phase 1 — Homepage Redesign") && plan.includes("## Phase 2 — Jewellery Listing + Product Detail") &&
  plan.includes("## Phase 3 — Gift Hampers + Custom Hamper Builder"),"Keep the owner-approved three-phase competitor shopping roadmap intact")
console.log(`Final tasks 7–9 source QA passed: 89 SKU mappings in ${Object.keys(counts).length} categories, 67 original fallbacks, gallery gesture/keyboard protections, mobile buy bar, filter accessibility, truthful product/order proof and no sample marketing text.`)
