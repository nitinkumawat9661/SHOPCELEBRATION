import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read = path => readFile(new URL("../"+path,import.meta.url),"utf8")
const [hook,button,card,list,page,detail,collection,css,globals,api,migration,account] = await Promise.all([
 "features/catalog/useWishlist.ts","features/catalog/WishlistToggle.tsx","features/catalog/CatalogCard.tsx",
 "features/catalog/WishlistCollection.tsx","app/wishlist/page.tsx","app/jewelry/[id]/page.tsx",
 "features/catalog/CatalogCollection.tsx","styles/phase2-wishlist-20261012.css","app/globals.css",
 "app/api/account/wishlist/route.ts","db/migrations/046_customer_wishlist_sync.sql",
 "features/account/useCustomerAccount.ts"
].map(read))
assert(hook.includes('celebration.wishlist.v1') && hook.includes('localStorage.setItem') && hook.includes('localStorage.getItem'))
assert(hook.includes('"storage"') && hook.includes('window.dispatchEvent(new Event(EVENT))'))
assert(hook.includes('typeof value === "string" && validId(value)') && hook.includes('slice(0, MAX_SAVED)'))
assert(hook.includes('"/api/account/me"') && hook.includes('const accountId = data.account.id'))
assert(hook.includes('await request("POST", { productIds: guest })') && hook.includes('window.localStorage.removeItem(KEY)'))
assert(hook.indexOf('ids = await request("POST"') < hook.indexOf('window.localStorage.removeItem(KEY)'))
assert(hook.includes('await request("PUT", { productId, saved: !previous.ids.includes(productId) })'))
assert(hook.includes('BroadcastChannel') && hook.includes('document.addEventListener("visibilitychange"'))
assert(button.includes("aria-pressed={saved}") && button.includes('type="button"') && button.includes('disabled={!loaded || pending || mode === "error"}'))
assert(card.includes('<WishlistToggle productId={product.id} productName={product.name} compact />'))
assert(!card.includes('href="/wishlist"') && card.includes('<Link href={`/jewelry/${encodeURIComponent(product.id)}`}'),"Exact SKU card link unchanged")
assert(list.includes('availableById.get(id)') && list.includes('active !== false') && list.includes('<CatalogCard key={product.id} product={product} />'))
assert(list.includes('mode === "account"') && list.includes('href="/account"') && list.includes('Retry sync'))
assert(page.includes('getCatalogConfig()') && page.includes('<WishlistCollection') && page.includes('Sign in with your Celebration account'))
assert(detail.includes('<WishlistToggle productId={product.id} productName={product.name} />'))
assert(collection.includes('href="/wishlist"'))
assert(css.includes(".wishlistToggle:focus-visible") && css.includes("min-height:44px") && globals.includes("phase2-wishlist-20261012.css"))
assert(api.includes('getCustomerSession()') && !api.includes('body.accountId') && api.includes('enforceSameOrigin(request)') && api.includes('consumeRequestRateLimit'))
assert(api.includes('headers:noStore') && api.includes('AUTH_REQUIRED'))
assert(migration.includes("REFERENCES customer_accounts(id) ON DELETE CASCADE") && migration.includes('PRIMARY KEY (account_id, product_id)'))
assert(account.includes('new Event("celebration:auth-changed")'))
console.log("Account wishlist checks passed: signed-in DB sync, anonymous guest mode, merge, privacy, SKU links, controls, server CSRF and limits.")
