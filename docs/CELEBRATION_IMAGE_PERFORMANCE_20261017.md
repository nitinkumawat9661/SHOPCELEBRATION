# Celebration product-photo performance pass — 17 Oct 2026

**Status:** Source changes on review branch only. Live website and VPS database are unchanged until main is merged and the existing production deploy succeeds. **No claim of a 99 Lighthouse result has been made.**

## Findings from inspected code and repository assets

- The previously reported Meesho browser request problem was addressed earlier: 67 product photos were moved to Celebration-owned R2 with 201 exact-source WebP derivatives. The old original URLs are provenance data; do not expose them as customer browser fallbacks.
- 22 owner-hosted necklace originals remained **~1.9–2.5 MB PNGs apiece**. Normal product cards requested these full PNGs despite a thumbnail-sized display.
- The safe-image CSS forced `opacity:0` until React hydrated and `HTMLImageElement.decode()` finished. That could delay visible real pixels and mobile LCP even after an image loaded.
- The R2 route already avoided presigned round-trips, but requests still made repeat VPS-to-R2 fetches after browser cache expiry.

## Changes on this branch

1. Before `npm run build` or `npm run dev`, generate 360/900/1600-pixel WebP variants directly from each of the 22 unchanged original PNGs. All variants preserve exact SKU, original source and aspect ratio. They are **build outputs, not database changes**. The original PNG remains a same-SKU image fallback.
2. Render available image pixels immediately with native browser paint, independent of hydration and decode state. Preserve branded HTML loading/error UI and per-SKU isolation.
3. Add a **32 MiB bounded, process-local LRU** for immutable SHA-256-addressed R2 WebPs; coalesce concurrent reads of the same key. Dynamic admin uploads are excluded.
4. Cache immutable source-hashed R2 WebPs for a year in clients/eligible proxies. Cache newly generated local WebP assets for one day, since their URL is not content-hashed.
5. Extend existing audit scripts with 22-SKU variant/fallback checks. No catalog, price, inventory, account, payment, shipment or category photo mapping was modified.

## Mandatory production verification before declaring success

1. Before merge: `npm ci && npm run audit && npm run build` on the branch. Confirm 66 generated local WebP variants and no generated files accidentally committed.
2. After merge + existing rollback-safe GitHub deploy: verify `/api/health`, `/jewelry`, and a first-party SKU `/jewelry/celebration-necklace-001` plus an R2-backed SKU on mobile. Confirm correct **WebP** `Content-Type`, real image pixels, correct names, cart and checkout.
3. For `/catalog/necklaces-optimized/celebration-necklace-001-thumb.webp`, verify HTTP 200 and intended browser cache header. For an R2 `/api/catalog/image?key=...` variant, verify HTTP 200, short TTFB after warmup and no Meesho image request.
4. Test 3 mobile Lighthouse/PageSpeed runs per route: homepage, `/jewelry`, a local-PNG-origin product and an R2 product. Record median **Performance**, **LCP**, **TBT**, **CLS**, **INP** where available, image request waterfall, initial document response, and cache hit. Separately test desktop. The owner's target is **99**, not a tested outcome yet.
5. If 99 remains unmet, investigate CDN edge caching for **public catalog only**, request waterfalls, JS hydration cost and server/database TTFB from those concrete reports. Never expose customer/private order, custom-hamper or review photo objects on a public CDN.
6. Watch real-user Web Vitals and product image errors 24–72 hours after deploy. Do not confuse a single Lighthouse lab score with real-user experience.

## Rollback / operational isolation

- Main merge triggers existing immutable-release VPS deployment, with its existing rollback logic. This branch is intentionally not directly deployed.
- The database, per-SKU image originals, R2 photo objects and payments remain untouched.
- `/catalog/necklaces-optimized/` is generated at build start and excluded from Git.
- The cached objects are immutable SHA-256 keys only, so no private images or mutable uploads enter the memory cache.
- Search Console, Bing and Merchant Center do not need resubmission for this code-only display optimization. Check product photos in live schema and Merchant diagnostics as a follow-up, not an invented approval claim.

**No new GitHub Actions workflows** were added.
