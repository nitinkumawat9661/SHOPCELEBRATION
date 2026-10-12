import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=file=>readFile(new URL("../"+file,import.meta.url),"utf8")
const [qa,workflow,filters,listing,gallery,buy,detail]=await Promise.all([
 "scripts/audit-phase2-jewelry-final-browser.mjs",".github/workflows/phase2-jewelry-final-browser-qa.yml",
 "features/catalog/JewelryMarketplaceFilters.tsx","features/catalog/CatalogCollection.tsx",
 "features/catalog/ProductGallery.tsx","features/cart/AddToCart.tsx","app/jewelry/[id]/page.tsx"
].map(read))
assert(qa.includes("for(const width of [320,390,430,1280])"))
assert(qa.includes('route.abort("blockedbyclient")') && qa.includes('method==="GET"||method==="HEAD"'))
assert(qa.includes("ascending price sort") && qa.includes("descending price sort") && qa.includes("category exact-match") && qa.includes("price >=₹180"))
assert(qa.includes("authentic SKU photo loads") && qa.includes("single-photo SKU has no invented gallery angles"))
assert(qa.includes("Buy Now routes exact SKU to cart") && qa.includes("responsive first-row columns") && qa.includes("no page horizontal overflow"))
assert(workflow.includes("Deploy Celebration Production") && workflow.includes("workflow_dispatch") && workflow.includes("audit-phase2-jewelry-final-browser.mjs"))
assert(filters.includes('aria-modal="true"') && filters.includes('event.key === "Escape"'))
assert(listing.includes("discoverProducts(products, filters)") && listing.includes("<CatalogCard key={product.id} product={product} />"))
assert(gallery.includes("productImages(product)") && gallery.includes("images.length > 1"))
assert(buy.includes('router.push("/cart")') && detail.includes("buyNow"))
console.log("Phase 2 final jewellery QA contracts passed: real Chromium, safe GET-only testing, filters, gallery, exact-SKU cart and mobile geometry.")
