# Celebration Redis Public Storefront Cache — 17 October 2026

## Root cause addressed
Previously homepage, jewellery listing and product detail routes invoked `getCatalogConfig()` for **every visitor**. That function read the DB catalog and then ran an inventory transaction, expired-reservation processing, inventory upsert and stock SELECT on each request. Homepage also read category images; jewellery pages fetched settings separately.

**This is a source-level bottleneck, not proof it caused all of Lighthouse 74.** Redis can improve server TTFB and DB load, but does not automatically eliminate JS long tasks or image render delays.

## Implementation
- `lib/server/public-store-cache.ts` has Redis RESP2 over Node's `node:net` (no new dependency): short-lived 2s local cache, per-key in-flight deduplication, Redis as a shared cache across processes, 250ms bounded network calls with a failure backoff.
- `lib/server/public-storefront.ts` exposes shared **public only** snapshots:
  - `catalog`: Redis TTL **8s**; includes *display stock*, therefore 8s maximum planned delay. Checkout/stock reservations still use the DB directly.
  - `store-settings`: Redis TTL **60s**; only information intended for public pages.
  - `home-category-media`: Redis TTL **120s**; editor art is not reset.
- Uses same cached key for all visitors, regardless of search filters, URL or account identity. Does not cache authenticated requests, customer profiles, cart/checkout amounts, orders, payments, inventory mutation endpoints or private files.
- The relevant public storefront routes, public API and sitemap share the catalog key.
- Admin Save live / Publish / Rollback invalidate public catalog AFTER commit. Save stock invalidates catalog after commit. Store settings save invalidates settings.
- If Redis is unavailable, the site **stays operational using 2s in-process cache and original DB**. Does not silently install or expose Redis; protected/remote services must be configured separately.

## Redis readiness and setup
- Default connection: loopback `redis://127.0.0.1:6379/0`, never put a public host in a browser.
- Optional private environment override: `CELEBRATION_REDIS_URL`. Can include Redis username/password. Store only in `/var/www/celebration/shared/.env.production`, never commit credentials.
- Existing deploy workflow reports `CELEBRATION_REDIS_STATUS=ACTIVE` **only** if local Redis PING succeeds. An `UNAVAILABLE` log means Redis L2 is NOT active; the performance improvements then come only from the short L1.
- If absent, a VPS administrator must provision a properly secured Redis/Valkey service bound to loopback only and verify PING **before** claiming production Redis activation. Do not install/modify Redis globally if another application uses it without checking impact.
- Redis is cache-only, not a database-of-record; short TTL prevents stale catalog prices and stock from persisting. Real money checkout remains authoritative.

## Verification gate
1. `npm ci && npm run audit && npm run build`, including mocked Redis RESP2 fragmentation/coalescing/invalidation.
2. Existing rollout to immutable release must pass PM2/public HTTP health, robots and sitemap.
3. Deployment logs must explicitly show Redis active or unavailable. Do not misreport an optional adapter as an active Redis service.
4. Page tests: /, /jewelry, necklace-001 and an R2 SKU; compare HTML TTFB cold/hot, Redis hits, Postgres catalog query count; inspect image waterfall and true mobile Lighthouse.
5. Verify a real admin catalog update becomes visible within **8s** even on race, stock within 8s, settings within 60s. Run an authorized single-product smoke test, not a forced inventory rewrite.
6. Ensure cart/payments independently validate the real database price and quantity at checkout.
7. To address a Lighthouse score of **74**, also measure JavaScript main-thread time, image LCP/priority, media TTFB, and RSC payload. **No 99 score claim until measured**.
8. No Google Search Console or Merchant resubmission just for backend caching. If price/stock is changed in the DB, use the existing data-change follow-up runbook.

## Rollback
Single PR through the existing main workflow; immutable release rolls back automatically on failed health check. Redis is **not** an authoritative source of data. All existing catalog, order, payment and inventory records remain untouched.
