> **ROLLBACK NOTICE — 17 Oct 2026:** After deploying PR #214, the owner measured **Mobile PageSpeed 76 versus previous 92**. The responsive Next/Image proxy for category-v7 R2 images has been rolled back in hotfix PR #215. The implementation below is retained as a historical attempt, **NOT the current production behavior**. Do not re-enable until measured source-level/trace tests explain the regression. Desktop 99 is the prior owner's observation; the rollback's new score requires retest.

# Celebration — PSI 92 responsive category art correction (17 Oct 2026)

## Recorded evidence (owner-supplied Lighthouse image table)
Owner reports **Mobile 92 / Desktop 99**. Detailed PageSpeed "Improve image delivery" audit identifies **476.9 KiB downloaded; 325.5 KiB estimated savings** across first-party images.

The dominant 4 requests are the ORIGINAL, owner-approved **category-v7** R2 art, currently downloaded at **640 × 640** despite an observed **187 × 187** visual presentation:

| Real owner art URL suffix | Download | PSI estimated saving |
| --- | ---: | ---: |
| `category-v7/trending-necklaces.webp` | 77.2 KiB | 71.5 KiB |
| `category-v7/necklace-earring-sets.webp` | 71.8 KiB | 66.1 KiB |
| `category-v7/premium-necklaces.webp` | 66.5 KiB | 60.8 KiB |
| `category-v7/bangles-bracelets.webp` | 61.8 KiB | 56.6 KiB |

Those four have **255.0 KiB of estimated image savings combined**, or ~78% of the 325.5 KiB reported opportunity. Additional findings are a 46.6 KiB already-small hero-800 WebP, several existing ~14–29 KiB true SKU thumbnails, and occasional lower-page decorative images. **Do not swap genuine product artwork or sacrifice the only LCP hero for speculative compression.**

Original file submitted by the owner: "Pasted markdown(20261017-073734).md".

## Implemented
- Change **only** `features/home/CategoryEditorialPhoto.tsx` from a bare `<img src={src} width={640} height={640}>` to Next.js `<Image src={src} ... sizes="(max-width: 700px) 188px, (max-width: 1100px) 200px, 256px" quality={75}>`.
- Let the built-in Next.js image optimizer resize and cache responsive variants from **the same untouched Celebration-owned R2 source URL**. No change to R2 objects, category mapping, database, product SKU photos, SVG masks, card layout, or editorial text.
- Retain the original `loading="lazy"` and noncritical fetch priority behavior for offscreen navigation circles.
- Keep transparent circular appearance and CSS crop exactly as before; original source is 1:1, dimensions remain 640 × 640 for layout stability.
- **Safety fallback:** if a Next image optimization request fails, retry the ORIGINAL SAME-SOURCE URL without optimization before falling back to the original branded category letter.
- Use **quality=75**, the Next.js 16 default allowlisted image quality, avoiding a 400 from unapproved `q` values.
- Add a scoped regression test to `npm run audit`.

## Required post-deploy verification
1. Existing `npm ci`, `npm run audit`, production Next.js build, immutable release, health and rollback checks must pass.
2. On mobile browser Network, category-v7 art should now request `/_next/image?url=...` with `w=256` or nearest browser-required responsive width and `q=75`, rather than all **640 × 640** originals. Retina browsers can legitimately request a 2× density variant.
3. Confirm optimized request returns **HTTP 200**, `image/webp` (or another accepted format), and the same owner's jewelry/gift/category artwork as prior to the change. A failed optimizer request must visibly recover using direct R2 image with no broken category circle.
4. Confirm 8 genuine category links, labels and image-to-category pairings, default featured 2/4 cards, cart, wishlist, PDP/gallery and mobile checkout unchanged.
5. Repeat mobile PageSpeed **three times**, compare median: Performance, LCP, FCP, TBT, CLS and remaining image savings. **Do not claim 99, 255 KiB realized saving or zero CLS without measurement.**
6. If cache lifetimes (247 KiB) or render-blocking CSS (910 ms) remain: capture exact resource names and priorities separately; avoid globally deferring commerce-critical styles.
7. No Search Console or Merchant Center resubmission solely for responsive image delivery.

Official Next 16 quality restriction: https://nextjs.org/docs/app/guides/upgrading/version-16

This change is intentionally homepage-category-image-only; **no new public R2 write, price, stock, private photo, order or payment mutation**.
