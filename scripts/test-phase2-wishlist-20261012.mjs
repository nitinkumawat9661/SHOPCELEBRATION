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
assert(!collection.includes('wishlistBrowseLink'),"Redundant saved collection shortcut was replaced by the shared header")
assert(css.includes(".wishlistToggle:focus-visible") && css.includes("min-height:44px") && globals.includes("phase2-wishlist-20261012.css"))
assert(api.includes('getCustomerSession()') && !api.includes('body.accountId') && api.includes('enforceSameOrigin(request)') && api.includes('consumeRequestRateLimit'))
assert(api.includes('headers:noStore') && api.includes('AUTH_REQUIRED'))
assert(migration.includes("REFERENCES customer_accounts(id) ON DELETE CASCADE") && migration.includes('PRIMARY KEY (account_id, product_id)'))
assert(account.includes('new Event("celebration:auth-changed")'))
const [header,headerLink,accountPage,premium,collectionUI] = await Promise.all([
 "features/shell/StorefrontHeader.tsx","features/shell/WishlistHeaderLink.tsx",
 "features/account/CustomerAccountPage.tsx","styles/wishlist-premium-20261013.css",
 "features/catalog/CatalogCollection.tsx"
].map(read))
assert(header.includes("<WishlistHeaderLink />") && header.includes("<NotificationLink />") &&
 header.indexOf("<WishlistHeaderLink />") < header.indexOf("<NotificationLink />") &&
 header.indexOf("<NotificationLink />") < header.indexOf("<CartLink />"),"Wishlist, notifications, cart in header")
assert(headerLink.includes('href="/wishlist"') && headerLink.includes("useWishlist()") &&
 headerLink.includes("ids.length"),"Saved count uses actual shared wishlist hook")
assert(!accountPage.includes('href="/wishlist"'),"Remove redundant account wishlist button")
assert(!collectionUI.includes("wishlistBrowseLink"),"Remove redundant browse-page shortcut")
assert(list.includes("wishlistCategoryChips") && list.includes("availableById.get(id)") &&
 list.includes('<CatalogCard key={product.id} product={product} />'),"Scoped category filter and exact SKU cards preserved")
assert(premium.includes("@media(max-width:375px)") && premium.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"Narrow header and 2-column mobile saved list")
assert(premium.includes("@media(min-width:1001px) and (max-width:1150px)") && premium.includes(".celebrationIconLink span{display:none}"),"Laptop header avoids 1024px overflow")
const wishlistPage = await read("app/wishlist/page.tsx")
assert(!wishlistPage.includes("wishlistHero") &&
 !wishlistPage.includes("CURATED BY YOU") &&
 !wishlistPage.includes("Pieces you"),"No wishlist marketing hero")
assert(wishlistPage.includes("<WishlistCollection") && wishlistPage.includes("wishlistBreadcrumb"),"Keep saved pieces list and breadcrumb")
assert(!premium.includes(".wishlistHero") && !premium.includes(".wishlistHeroArt"),"Remove unused hero styling entirely")
assert(globals.includes('wishlist-premium-20261013.css'),"Ship standalone premium wishlist")
console.log("Account wishlist checks passed: signed-in DB sync, anonymous guest mode, merge, privacy, SKU links, controls, server CSRF and limits.")
