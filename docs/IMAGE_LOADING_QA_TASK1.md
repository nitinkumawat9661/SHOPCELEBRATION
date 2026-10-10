# Task 1 — Product image reliability: diagnosis and QA

Date: 2026-10-10  
Tracking plan: [FINAL_POLISH_AND_AI_FEEL_REMOVAL.md](./FINAL_POLISH_AND_AI_FEEL_REMOVAL.md)  
Code: `features/catalog/SafeCatalogImage.tsx`, `ProductGallery.tsx`, `CatalogCard.tsx`, `styles/catalog-image-reliability.css`

## Source-level findings (verified by inspection)

1. **CSS sprite backgrounds had no `onError` or pending-state UI.** The old gallery/card rendering used a `backgroundImage` on a white block, so a broken or stalled sprite request could not transition to a branded fallback. Those surfaces now use `SafeCatalogImage` and retain tile position through `objectPosition`.
2. **An undecoded/slow product image could leave the stage looking white.** The old gallery CSS painted plain white behind the image and the old component had no visible loading state or stalled-request timeout. The new loader paints a local branded HTML layer immediately and reveals the image only after its pixels decode.
3. **A failed `srcSet` candidate previously jumped straight to the original fallback.** The new order is *hosted responsive candidate → hosted main without `srcSet` → validated same-product original → local branded SVG → inline HTML branding if the SVG also fails*.
4. **Gallery selection state was an index only.** The new selection is tied to `product.id`; the main image is keyed by SKU plus image URL; stale load/decode/error events check the current DOM node and source key.
5. **Catalog seed media is not evidence that more photo angles exist.** Existing gallery supports any supplied real additional images, but no new viewpoints were fabricated or borrowed from another product.

These are **code-supported failure mechanisms, not a confirmed root-cause reproduction from a production browser**. The original intermittently white-box report still needs live HTTP/CDN/device evidence.

## Automated checks

Run `npm run audit` (includes `test-image-loading-reliability.mjs`, all existing image-source ownership and storefront regressions) and `npm run typecheck`. The new test executes the actual source-candidate builder and checks fallback order, empty source, duplicate candidate, missing responsive derivative retry, gallery state reset, placeholder visibility rules, and no unobservable CSS sprite backgrounds. CI success must be recorded from the associated PR; it does **not** substitute for a real browser test.

## Manual browser QA — still required

For each case record: product ID, full page URL, time and timezone, viewport, OS/browser, network speed and online/offline state, the actual image request URL, HTTP response/content-type/cache headers (when available), `currentSrc`, `naturalWidth`, screenshot or short recording, and result.

| Scenario | How to verify | Pass criteria |
| --- | --- | --- |
| Normal direct product page | Open an actual SKU on first visit and reload with cache disabled | Genuine SKU image appears; no persistent white block |
| Responsive R2 derivative 403/404 | In DevTools block the `zoom.webp` request only | Hosted `main.webp` (same SKU) is retried |
| Full primary 403/404 | Block all `/api/catalog/image` for a test SKU | Same SKU's validated original is tried, then local branded placeholder if needed |
| Offline / stalled network | Emulate offline/Slow 3G, block the image response or throttle | Visible local HTML branding immediately; bounded attempt advances without permanent white rectangle |
| Branded SVG blocked too | Also block `/images/celebration-product-placeholder.svg` | Inline branded text remains visible, not an empty white box |
| Rapid gallery taps | Move next/previous and tap thumbnails quickly on products with real multi-angle photos | Final selected index is right; no stale image, no cross-SKU photo |
| SKU switch / browser history | Navigate from SKU A to SKU B and back | Image selection/fallback state resets to each SKU |
| Small and large viewports | 320, 360, 390, 430, 768 and 1440px | Gallery stage, branded state and any thumbnails remain visible |
| Genuine one-image SKU | Use a SKU with only the primary photograph | No fabricated image slides or duplicate angles |
| Offline on slow mobile | Real Android/iOS browser as applicable | Branded fallback paints even if images cannot load |

**Current limitation:** No production-browser network/DevTools trace or phone screenshot was available in the coding environment, so none of the manual rows may be marked passed. No live R2/CDN HTTP status has been inferred from the code alone.

## Image identity gate

- Continue to run `scripts/test-image-source-ownership.mjs` and `scripts/audit-catalog-image-ownership.mjs --dry-run`.
- Keep `lib/server/catalog.ts` same-original-URL hash validation. Do not alter the `content/catalog.json` SKU-to-photo mapping while fixing the loader.
- Record the original image source, rehosted key, current SKU and visual thumbnail agreement before any replacement. Missing new angles must remain unfilled.
