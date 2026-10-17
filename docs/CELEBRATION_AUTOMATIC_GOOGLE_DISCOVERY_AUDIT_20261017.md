# Celebration — automatic Google discovery and product crawl audit (17 Oct 2026)

## Owner's explicit requirement
**No one-by-one indexing requests for 95 product/storefront pages.** New or edited live products must become discoverable automatically. Preserve the stable **Mobile Lighthouse 92 and Desktop 99** site; avoid changes to product cards, marketing images, checkout, prices, stock or front-end bundle.

**Be precise:** Having a URL in a successfully submitted sitemap means Google has a discovery mechanism; it does NOT prove it has crawled, chosen to index, ranked or shown that URL. Google controls those decisions. Repeated manual requests are not required or recommended for a complete URL catalog. There is no legitimate API to force automatic Google Search indexing of ordinary commercial product pages.

## Code audit performed
- **Indexable product pages:** `app/jewelry/[id]/page.tsx` includes product-name metadata, per-SKU canonical `/jewelry/<id>`, real price/stock Product JSON-LD and BreadcrumbList.
- **Internal linking:** `features/catalog/CatalogCollection.tsx` maps matching live jewelry into `<CatalogCard>`; each card contains an explicit Next `<Link href="/jewelry/<SKU>">` anchor, not an onClick-only link. All 89 seed products are within jewelry categories.
- **Dynamic data source:** live catalog is read from PostgreSQL via `getPublicCatalogConfig()` and Redis (8-second L2 TTL), not a static bootstrap list. Inactive products are excluded from sitemap.
- **Robots:** public pages and `/api/catalog/image?key=` may be crawled; unrelated API/customer routes are blocked.
- **Canonical URLs:** homepage, `/jewelry`, PDP and public `/curated-hampers` have explicit canonical metadata. Filtered `/jewelry?q=` et al are noindexed/canonical to `/jewelry`.
- **Not all static routes are eligible:** `/policies`, `/terms` and `/privacy` explicitly declare `noindex`; including them in a sitemap would contradict their directives. Keep them excluded.
- **Catalog text:** all 89 current seed products have descriptions, with no exact duplicate description; one exact duplicate product display name exists (`Korean Pearl Flower Pendant Necklace` on two SKU IDs). Those two verified designs require independent merchandising review before renaming anything. Do NOT auto-edit, merge or redirect products to 'fix' the name.
- **Original problem discovered:** `app/sitemap.ts` lacked an explicit dynamic setting even though owner publishes live products via PostgreSQL admin changes; Next.js metadata sitemaps may be cached by default, so a new SKU could have been absent until rebuild.

## Changes on this branch (no storefront rendering modifications)
1. `export const dynamic = "force-dynamic"` on `app/sitemap.ts`. New active products and removed/deactivated products are reflected on the next route fetch, subject to Redis's short public snapshot cache and any intermediate CDN/browser cache. No deploy should be required for a normal admin product publish.
2. Include **/curated-hampers**, an existing public canonical customer page that was omitted from the sitemap.
3. Each eligible product sitemap entry references **its own real primary image** through `catalogImageVariant(..., "main")`, which maps 67 verified source-hash R2 photos to their existing `main.webp` and 22 local original necklace PNGs to their existing `-main.webp`. Only Celebration-origin public URLs are allowed. No original photos, content or file bytes change. This helps Google discover product media independently from HTML, without a new page/JS payload.
4. Preserve 89 original product URLs and all index/price/stock status. Do not generate fake `lastmod` dates, scrape, submit to third-party 'instant indexing' services or add sitemap private pages.
5. Add simulated admin-publish/crawl-coverage regression test `scripts/test-seo-automatic-discovery-20261017.mjs` to the existing `npm run audit`.

**Expected new sitemap size with 89 active products:** **96 total URLs = 7 public static + 89 products** (formerly 95 = 6 + 89). The sitemap count grows/shrinks automatically with legitimate catalog publishing. This is **NOT** a count of Google-indexed pages, and no fixed 89 cap exists in the app code.

## Release gates and recheck
- CI `npm run audit`, TypeScript and Next.js production build must pass. Existing immutable VPS deployment and rollback + `/api/health` + robots + sitemap URL checks must pass.
- Production smoke: XML includes exactly the currently active SKUs and `/curated-hampers`; check at least two R2 image `<image:loc>` and one local-necklace WebP, each same SKU and 200 with `image/webp`.
- Verify `/jewelry` linked HTML contains product anchors and one or two live PDPs have title, canonical, indexability and correct JSON-LD (without mutating state).
- After publishing a new product in admin, its link and XML should become visible quickly. Verify with HTTP request and cache headers; don't claim an exact Google crawl time.
- **Search Console:** existing submitted `https://shopcelebration.in/sitemap.xml` stays the same; do not repeatedly submit all product URLs or an extra sitemap. The Sitemaps report may take time to update 'Discovered pages' count after re-fetch.
- When `Indexing → Pages` starts showing data, investigate specific reasons, especially `Crawled – currently not indexed`, duplicates/canonical and thin or identical product descriptions. One URL Live Test reported **available to Google**; a requested index is not a guarantee.
- **Merchant Center:** complete account verification and review discovered product inventory/feed separately, matching live prices/stock. A sitemap is not a substitute for Merchant Center product feed.
- **Lighthouse:** HTML/CSS/JS/images on home, listing and PDP are unchanged. The only runtime code difference is the search-engine-only sitemap response. Maintain mobile 92 / desktop 99 as observed before this change; if new scores differ, investigate independently without reverting unrelated product performance work.

Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview and https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap .
