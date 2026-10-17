# Celebration mobile PageSpeed 75 critical-path pass (17 Oct 2026)

## User-provided baseline and proof level
Mobile PageSpeed Insights screenshots showed **Performance 75, Accessibility 100, Best Practices 92, SEO 100**. Visible actionable estimated opportunities:
- Render-blocking requests: **1,050 ms**
- Improve image delivery: **677 KiB**
- Use efficient cache lifetimes: **341 KiB**
- LCP request discovery flagged
- Legacy JavaScript: 14 KiB

The detailed request rows/LCP timings were NOT visible in the screenshots. These are **estimated audit opportunities, not guaranteed measured savings**. VPS curl readings provided by owner were ~0.292s home, 0.380s jewelry, 0.367s PDP. The Redis `celebration:public:v2:catalog` key exists and Redis CLI answered PONG; this establishes first-party catalog caching, but not a 99 score.

## Changes (safe, targeted, source-grounded)
1. **Route-scope private admin CSS.** Seven `styles/admin*` imports were in the root `app/globals.css` despite already having `app/admin/layout.tsx`. Remove those seven imports from global and include all seven, preserving order, in `app/admin/layout.tsx`. This avoids sending admin-only CSS to public home/jewelry/PDP while preserving admin styles for admin pages. Actual compressed bundle reduction must be measured after build; do not infer directly from source CSS sizes.
2. **Fix the homepage hero's default lazy loading.** In Next.js 16, `next/image` is lazy by default. The real first-party `hero-800.webp` (47 KB) on mobile and `hero-1600.webp` on desktop were used inside `<picture>`, with `fetchPriority="high"` but **no `loading="eager"`**. Explicitly mark the *same original imagery* as eager/high. No art, photo crop, headings or element layout changes.
3. **Prevent off-screen editorial images from competing with LCP.** Homepage's first three `CategoryEditorialPhoto` items were unconditionally marked eager/high even though the category rail appears below the hero. Use existing native lazy behavior for editorial photos, which browsers will still fetch as they approach viewport. No image/URL/SKU mappings change.
4. **Browser cache for immutable-in-deployment campaign images.** Set public `/images/campaign/:path*` static asset cache header to 7 days with bounded stale revalidation. Files are not content-hashed, so **do not mark them immutable for a year**. No change to private API/cache, customer photos, cart/checkout or inventory. Existing admin/account/payment `no-store` headers preserved.
5. **Don't eagerly preload decorative script font.** Allura 26 KB is only fetched when needed. The real Bodoni and Inter families, logo and critical visual design are unchanged.

## Regression gates
- Existing `npm run audit` and `npm run build` plus `scripts/test-psi75-critical-path-20261017.mjs`.
- Existing GitHub Actions immutable release and automatic health rollback; production robots/sitemap checks.
- Verify real screenshots for original hero, circular category images, correct product SKUs, admin and mobile checkout.
- Re-run the same PageSpeed mobile test on the same URL and collect three trials; compare the median of Performance, FCP, LCP, TBT and CLS, plus render-blocking and image requests.
- If still <90, open detailed PageSpeed rows to identify the **actual** 677 KiB over-delivered images and the 1,050ms blocking URLs before further edits. Avoid arbitrarily deferring legitimate LCP fonts or product images.

**DO NOT claim score 99 or even an improved score until retested.** SEO sitemap, product stock, payment validation, real reviews and active SKU image content are untouched.
