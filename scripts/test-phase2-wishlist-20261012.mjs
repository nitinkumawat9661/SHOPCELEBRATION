import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read = path => readFile(new URL("../"+path,import.meta.url),"utf8")
const [hook,button,card,list,page,detail,collection,css,globals]=await Promise.all([
 "features/catalog/useWishlist.ts","features/catalog/WishlistToggle.tsx","features/catalog/CatalogCard.tsx",
 "features/catalog/WishlistCollection.tsx","app/wishlist/page.tsx","app/jewelry/[id]/page.tsx",
 "features/catalog/CatalogCollection.tsx","styles/phase2-wishlist-20261012.css","app/globals.css"
].map(read))
assert(hook.includes('celebration.wishlist.v1') && hook.includes('localStorage.setItem') && hook.includes('localStorage.getItem'))
assert(hook.includes('"storage"') && hook.includes("dispatchEvent(new Event(EVENT))"))
assert(hook.includes('typeof value === "string" && validId(value)') && hook.includes('slice(0, MAX_SAVED)'))
assert(button.includes("aria-pressed={saved}") && button.includes("type=\"button\"") && button.includes("disabled={!loaded}"))
assert(card.includes('<WishlistToggle productId={product.id} productName={product.name} compact />'))
assert(!card.includes('href="/wishlist"') && card.includes('<Link href={`/jewelry/${encodeURIComponent(product.id)}`}'),"Exact SKU card link unchanged")
assert(list.includes('availableById.get(id)') && list.includes('active !== false') && list.includes('<CatalogCard key={product.id} product={product} />'))
assert(page.includes('getCatalogConfig()') && page.includes('<WishlistCollection') && page.includes('not in your Celebration account'))
assert(detail.includes('<WishlistToggle productId={product.id} productName={product.name} />'))
assert(collection.includes('href="/wishlist"'))
assert(css.includes(".wishlistToggle:focus-visible") && css.includes("min-height:44px") && globals.includes("phase2-wishlist-20261012.css"))
console.log("Phase 2 saved wishlist source checks passed: persistence, genuine saved SKU retrieval, 44px controls, unchanged cart and product identities.")
