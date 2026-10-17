# Celebration — PageSpeed mobile image-transfer follow-up (17 Oct 2026)

## Evidence: actual owner's fresh mobile PageSpeed screenshots
- **Image delivery estimated savings:** 676.9 KiB across same-site images; flagged image sample **Cute Korean Teddy Bear Pendant Necklace**, `/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F...`, downloaded **140.6 KiB** at **900 × 900**, rendered **304 × 304**. Google estimated **125.6 KiB** savings on this ONE card (124.6 KiB resizing + 8.8 KiB compression opportunity, estimates overlap).
- **Render-blocking:** 850ms estimated savings. Six Next-generated CSS chunks totaling **90.6 KiB**; visible request durations 320–950ms under Lighthouse throttling. Do not mistake sum of all request durations (4.44s) for a serial render delay.
- **Browser caching:** 247 KiB estimated savings, detailed resources NOT in screenshots.
- **Legacy JavaScript:** 14 KiB estimated savings.
- The full **Performance score, FCP, LCP, TBT, CLS** were not visible in this new report. Prior visible mobile score 75/100. No new 99 claim.

## Root-cause source finding
`features/home/HomeCatalog.tsx` was rendering the homepage's four featured product cards using `imageVariant="main"`. This requests the **900px R2 WebP** for a **thumbnail-sized card**, despite the store already having 360px `thumb.webp` variants in the *exact same SKU's R2 directory*. All product detail pages still need the 900px `main.webp`, and zoom still needs original large variant.

## Implementation and isolation
- Homepage featured cards now use `imageVariant="thumb"` to fetch the existing **360px same-SKU** public WebP, preserving exact image, transparent/white composition, crop, alt and fallback chain. No R2 writes, no Meesho CDN browser calls, no DB updates.
- Preserve original ring-001 portrait display via explicit `preserveFeaturedPortrait` flag **only** on homepage featured cards. Original two-across mobile and four-across desktop, authentic product selection, product cards, badges, prices, wishlist and cart remain unchanged.
- Other collection cards already use thumb. Product detail galleries still request 900px `main` and 1600px `zoom`. Owner can inspect full-resolution photo after tapping product.
- No rendering or caching logic changed in Next.js root, no private photos involved.
- Existing audits that had incorrectly hardcoded 900px homepage requests are updated to enforce correct thumbnail performance. New `scripts/test-home-featured-thumbnail-performance-20261017.mjs` verifies **67 R2 + 22 local** SKU maps retain thumb/main separation and the featured ring styling.

## Production verification / review
1. `npm ci && npm run audit && npm run build` via existing GitHub Actions before VPS upload. Build source audit, exact-SKU image tests, live health and automated rollback all mandatory.
2. Visit homepage mobile and desktop: featured four images show the **same real photos**, and ring preserves its portrait crop. Browser Network should request `/thumb.webp`, not `/main.webp`, for homepage featured R2 cards. R2 thumb should return `image/webp`; R2 main remains available on PDP.
3. Verify `/jewelry`, product detail, stock, admin catalog and add-to-cart are not regressed.
4. Run PageSpeed Mobile **three times** after deploy, compare medians with prior score 75, and inspect whether **676.9 KiB image-delivery estimate** shrinks.
5. If image savings persist, inspect precise remaining image list and map them to actual source components; do not substitute a different SKU or blindly recompress customer/owner artwork.
6. Render-blocking CSS 850ms **still needs a measured CSS critical-path pass** once the top image waste is removed; do not remove shared checkout/cart/hamper styles without route-level visual tests.

**Not an assertion that Lighthouse 99 is achieved**. Search Console/Merchant Center resubmissions are unnecessary for faster variant delivery. Real product names/photos/prices/stock unchanged.
