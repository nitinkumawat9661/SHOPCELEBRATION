import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

const root = new URL("../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")
const [faq, policies, footer, fit, detail, home, orders, sitemap, styles, globals, image, gallery, card, homeCatalog, plan] = await Promise.all([
  "app/faq/page.tsx",
  "app/policies/page.tsx",
  "features/shell/SiteFooter.tsx",
  "features/catalog/ProductFitDetails.tsx",
  "app/jewelry/[id]/page.tsx",
  "features/home/Storefront.tsx",
  "lib/server/orders/read.ts",
  "app/sitemap.ts",
  "styles/faq-and-final-polish.css",
  "app/globals.css",
  "features/catalog/SafeCatalogImage.tsx",
  "features/catalog/ProductGallery.tsx",
  "features/catalog/CatalogCard.tsx",
  "features/home/HomeCatalog.tsx",
  "docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md"
].map(read))

// FAQ answers must match already-published policy and make no blanket promise.
assert(faq.includes("export const metadata") && faq.includes('canonical: "/faq"'), "FAQ route must have its own SEO metadata")
assert(sitemap.includes("${base}/faq"), "FAQ must be discoverable from the sitemap")
for (const text of ["delivery", "pincode", "anti-tarnish", "guarantee", "returns", "packing video", "tracking", "refund", "measurements"]) {
  assert(faq.toLowerCase().includes(text), `FAQ missing ${text}`)
}
assert(policies.includes("only where the product page or Celebration support expressly confirms it"), "Published policy must continue limiting voluntary returns")
assert(faq.includes("available only when the product page or Celebration support expressly confirms"), "Do not promise blanket returns")
assert(faq.includes("only to products specifically marked as covered"), "Do not promise 6-month coverage across all products")
assert(faq.includes("Where a packing video is provided"), "Do not promise videos on every order")
assert(faq.includes("We do not publish guessed diameters"), "Never invent jewelry sizes")
assert(faq.includes("<details") && faq.includes("<summary"), "Accessible FAQ disclosure UI missing")
assert(faq.includes("<SiteFooter />") && faq.includes("<StorefrontHeader settings={settings} />"), "FAQ must use same shop navigation")

for (const path of ["routes.about","routes.policies","routes.terms","routes.privacy","routes.claim","routes.track","routes.account","routes.compliance"]) {
  assert(footer.includes(path), `Footer lost critical navigation: ${path}`)
}
assert(footer.includes('href="/faq"') && footer.includes('href="/jewelry"') && footer.includes('href="/#budgets"'), "Footer must link FAQ, products and hampers")
assert(footer.includes('aria-label="Shop links"') && footer.includes('aria-label="Help links"'), "Footer navigation needs meaningful grouped labels")

assert(fit.includes("if (!isJewelryProduct(product)) return null"), "Do not show jewelry fit advice on non-jewelry gifts")
assert(fit.includes('description || ""') && fit.includes("highlights"), "Only derive adjustability from product fields")
assert(fit.includes("adjustable") && fit.includes("preferred measurement"), "Actual adjustable items need safe sizing guidance")
assert(fit.includes("Exact measurements for this piece are not listed yet"), "Do not invent numeric measurements")
assert(detail.includes("<ProductFitDetails product={product} />"), "Product page must render fit notes where applicable")
assert(detail.includes('href="/faq"'), "Product page must link directly to FAQ")
const products = JSON.parse(await read("content/catalog.json")).products
assert(products.length >= 89, "Unexpected product removal")
assert(products.some((x) => x.category === "Adjustable Rings") && products.some((x) => /bangles/i.test(x.category)), "Ring and bangle fit guidance must remain meaningful")
assert(products.every((x) => !/\b(?:cm|mm|inch|inches)\b/i.test(x.retail?.netQuantity || "")), "Numeric product size information needs review before the generic copy is changed")

assert(home.includes("isPublicHamperOrderProof(initialSocialProof, tiers)") && home.includes("{visibleProof && ("), "Only validated, sufficiently large real delivered-order cohorts may render public proof")
assert(home.includes("paid and delivered hampers"), "Label proven delivery and payment accurately")
assert(orders.includes("payment_status IN ('paid', 'verified', 'success')"), "Do not count unverified payment attempts as social proof")
assert(orders.includes("status = 'delivered'"), "Only delivered, not merely non-cancelled, hamper orders may count")

// Initial images are correctly eager, other images lazy, with fixed dimensions
// and first-party 3-size WebP variants; unknown live 22 PNGs remain separate QA.
assert(image.includes("width={800}") && image.includes("height={800}"), "Prevent image layout shifts")
assert(image.includes('loading = "lazy"') && image.includes('decoding="async"'), "Gallery/card images need efficient default loading")
assert(image.includes("fallbackSrc") && image.includes("CATALOG_IMAGE_FALLBACK"), "Preserve same-SKU fallback then branded placeholder")
assert(gallery.includes('loading="eager"') && gallery.includes('fetchPriority="high"'), "Product's main hero image needs priority")
assert(gallery.includes('"zoom"') && gallery.includes('"thumb"'), "Gallery must retain responsive WebP variants")
assert(card.includes('loading={priority ? "eager" : "lazy"}'), "Off-screen card images should be deferred")
assert(homeCatalog.includes('loading="lazy"'), "Below-fold campaign image should be deferred")
const campaign = ["hero-1600.webp","hero-800.webp","jewelry-1600.webp","jewelry-800.webp","occasion-1600.webp","occasion-800.webp"]
const campaignDir = new URL("public/images/campaign/", root)
const publishedFiles = await readdir(campaignDir)
for (const file of campaign) assert(publishedFiles.includes(file), `Missing responsive WebP campaign asset: ${file}`)
assert(globals.includes('@import "../styles/faq-and-final-polish.css";'), "Final FAQ/footer/fit CSS must load")
assert(styles.includes(".faqPage") && styles.includes(".finalFooter") && styles.includes(".productFitDetails"), "Final CSS must style new features")
assert(/@media\(max-width:450px\)/.test(styles), "Final help/footer pages must fit small phones")

// Scan all customer-facing TSX/JSON for obvious filler/AI-credit phrases.
// A generic branded image placeholder for a FAILED image is legitimate.
const forbidden = [/powered by ai/i,/lorem ipsum/i,/sample testimonial/i,/dummy review/i,/insert (?:your|product) (?:text|description) here/i]
const paths = []
async function visit(dir, relative = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (["admin", "api", "fonts", "node_modules"].includes(entry.name)) continue
      await visit(join(dir, entry.name), `${relative}${entry.name}/`)
    } else if (/\.(tsx|json)$/.test(entry.name)) paths.push(join(dir, entry.name))
  }
}
await visit(new URL("app/", root).pathname)
await visit(new URL("features/", root).pathname)
for (const source of ["content/store.json", "content/ui.json", "content/errors.json"]) paths.push(new URL(source, root).pathname)
for (const path of paths) {
  const source = await readFile(path, "utf8")
  for (const regex of forbidden) assert(!regex.test(source), `Remove placeholder/customer-facing AI copy: ${path}: ${regex}`)
}

assert(plan.includes("## Phase 3 — Gift Hampers + Custom Hamper Builder"), "Storefront must remain within owner-approved gifting scope")
console.log(`Section 8 checks passed: FAQ policy consistency, fit accuracy, footer links, paid-only social proof, campaign WebPs, image loading and ${paths.length} source-surface placeholder scans.`)
