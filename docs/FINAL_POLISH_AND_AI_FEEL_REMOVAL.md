# Celebration — Final Polish & AI-Feel Removal

**Website:** https://shopcelebration.in  
**Repository:** `nitinkumawat9661/SHOPCELEBRATION`  
**Status:** Locked execution checklist; **all tasks start as `[ ] Pending`**.  
**Created:** 2026-10-10  
**Scope:** Existing Next.js storefront and the nine sections below. Do not expand the scope without explicit owner approval.

> This document is the source of truth when the owner says **“जो डॉक्यूमेंट में लिखा है उसी को फॉलो कर”**. Work sequentially, verify the result, and change a checkbox to `[x] Done` only after the corresponding acceptance checks actually pass. If a task needs original assets, evidence or physical-device validation that is unavailable, leave it pending and document the blocker rather than inventing results.

## 1. Product image loading — CRITICAL / FIRST

- [ ] Pending — Reproduce the intermittently white/blank image area on **product detail pages**. Record product ID, URL, viewport, network request, HTTP status, response type, timing and browser.
- [ ] Pending — Diagnose actual cause(s): missing/empty source, incorrect WebP variant, CDN/R2 access/cache/CORS or response issues, lazy/eager priority, `srcSet` candidate failure, state reuse/race between gallery images and product switches, image decode or CSS visibility. Do not assume a root cause without evidence.
- [ ] Pending — Fix the loading pipeline so each image handles **loading, loaded, failed, switched-source and stale-event** states safely; keep main product image appropriately prioritized.
- [ ] Pending — Guarantee a **visible branded unavailable-image state** after genuine source/fallback failures instead of a permanently blank white container. Ensure the placeholder itself renders without an external CDN dependency.
- [ ] Pending — Preserve strict image ownership: selected product's own hosted image → **same-product original** fallback → branded unavailable placeholder. Never substitute another SKU's photograph; verify source association at least four ways before replacing/migrating image data.
- [ ] Pending — Support **1 genuine main image + up to 2–3 additional genuine product-angle/close-up photos** per product where those actual same-SKU assets exist. Implement graceful 1-image galleries when no extra images exist; **never fabricate angles or use other products**.
- [ ] Pending — Test initial load, rapid thumbnails, previous/next, direct links, source change, 404/403/timeout simulation and no-network mode on desktop and mobile. Verify the actual visual outcome, not only code assertions.

**Acceptance:** A product image is visible or a clearly branded fallback is visible across tested paths; gallery switching is reliable; image-to-SKU mapping stays exact.

## 2. Product cards and photography — remove template-like repetition (SECOND)

- [ ] Pending — Audit existing photos for repeated “model + brand + icons + A Little Sparkle” composite layouts; inventory authentic available shots by **SKU and viewpoint**.
- [ ] Pending — Make primary catalog thumbnails more natural and varied: use **verified** clean product-only, on-model and lifestyle shots when provided; choose the best real primary image per SKU without changing identity. Avoid repeating the same heavy embedded artwork across cards.
- [ ] Pending — Do **not** digitally remove product characteristics, infer unseen stones/finishes/packaging or manufacture alternative views. If the only supplied image is a composite, preserve correctness and flag that SKU for a real-asset replacement.
- [ ] Pending — Add restrained UI variation (subtle badge alignment, crop treatment according to aspect ratio, desktop hover) without covering jewelry, breaking responsive grids, distorting photos or impairing accessibility.
- [ ] Pending — Review product cards at 320/360/390px and desktop; compare card thumbnail to detail-page photo and title for every affected SKU.

**Acceptance:** A varied, credible collection presentation from actual owned images, with no identity mismatch or repetitive decorative overlay introduced by the site.

## 3. Dynamic and truthful badges/discounts

- [ ] Pending — Audit the current badge resolver, source fields and “Save ₹XX” labels; compute real savings only from valid displayed MRP and sale price (no arbitrary discount claims).
- [ ] Pending — Show a contextual mix of **Bestseller / New / Limited / verified discount / no badge**, driven solely by **provable product data** (real sales, genuine publish date, low stock, actual price gap). **Never assign labels randomly to create variety.**
- [ ] Pending — Use small, distinct badge styling/positioning per badge type; keep text legible and product visible.
- [ ] Pending — Test missing data, zero/negative savings, sold out, 1–3 stock, badge combinations and responsive truncation.

**Acceptance:** Badge appearance is varied because the evidence varies, and unsupported labels are absent.

## 4. Mobile navigation and header usability

- [ ] Pending — Reproduce cut-off labels (e.g. **“Budget” → “Budg”**) on real phone widths and identify CSS overflow, text clipping, max-width and scrollbar issues.
- [ ] Pending — Ensure the entire navigation remains readable and reachable (visible fully or horizontally scrollable), without truncated words or inaccessible last links.
- [ ] Pending — Polish search, account and cart alignment, spacing, badges, iOS input behavior and keyboard focus on mobile.
- [ ] Pending — Check mobile widths **320, 360, 375, 390, 430px**; test swipe navigation, keyboard focus, cart state and no unintended horizontal page overflow.

**Acceptance:** All navigation options remain accessible; header controls are clear and tappable without overlap.

## 5. Homepage copy and visual rhythm

- [ ] Pending — Audit visible English homepage copy for repetition of **“thoughtful”, “little”, “heart”, “feel right”, “a lot of love”** and similar filler.
- [ ] Pending — Rewrite hero, category, featured, hamper, section CTA and benefit copy into specific, short, natural language; retain actual brand positioning and the chosen tagline.
- [ ] Pending — Adjust section rhythm with purpose (some breathing room, some tighter transitions) without shifting shopping anchors, harming readability or creating inconsistent mobile spacing.
- [ ] Pending — Compare before/after homepage appearance on mobile and desktop for credibility and shopping clarity.

**Acceptance:** Concrete, human English copy; no repetitive slogan loop or arbitrary layout randomness.

## 6. Honest social proof

- [ ] Pending — Inspect existing order-statistic eligibility and moderation rules. A “recently purchased” message can appear **only from verifiable completed/paid customer records**, with privacy-safe aggregation and no customer-identifying details.
- [ ] Pending — Show modest real homepage proof only if supporting order counts or verified purchase events exist. If no genuine data exists, display no fabricated counters, reviews or urgency.
- [ ] Pending — Confirm product reviews are gated by actual order + delivery and moderation; only genuine eligible reviews become public.
- [ ] Pending — Keep a clear **“Be the first to review”** empty state where there are no verified published reviews.
- [ ] Pending — Test manipulated requests, unsupported testimonials, no data, one real review, and authorized/unauthorized review publishing.

**Acceptance:** Every public claim can be traced to genuine, permissible data; empty state remains honest.

## 7. Improve “How to Style”

- [ ] Pending — Review the existing category resolver and copy for **Necklace / Necklace + Earrings Set / Ring / Bangle or Bracelet / Earring** and gift-only products.
- [ ] Pending — Replace generic phrasing with practical English outfit/pairing suggestions tailored to the confirmed category and known properties; explain wearing matching sets together or separately.
- [ ] Pending — Keep care tips brief, practical and non-duplicated; avoid unsupported composition, finish, stones, guarantees or fit claims.
- [ ] Pending — Verify every actual SKU is mapped to the correct category instructions; unknown items get truthful neutral guidance rather than a wrong category.

**Acceptance:** Specific, readable styling advice with accurate product identity and no invented attributes.

## 8. Final professional finish

- [ ] Pending — Refine display/body typography using the current locally hosted fonts: meaningful variations in line-height, letter-spacing, scale and hierarchy.
- [ ] Pending — Reduce mechanical repetition in card borders, grids, shadows and layouts; create restrained editorial variety while preserving consistent commerce UX.
- [ ] Pending — Refine buttons, verified badges, metadata, hover/focus and micro-elements without introducing fake decorative proof or noisy visual effects.
- [ ] Pending — Perform mobile spacing, 44px-or-larger touch-target, fixed buy bar, gallery gestures, scrolling, cart and filter overlay polish.
- [ ] Pending — Audit all customer-visible pages for AI credit, template filler, stock testimonial artwork and unfinished placeholder copy. Keep legitimate “image unavailable”/empty-data states.
- [ ] Pending — Perform a human visual review at desktop and mobile: avoid declaring the site “premium” or “AI-feel-free” from tests alone.

**Acceptance:** A cohesive, accessible premium storefront without obvious template repetition or unsupported content.

## 9. Tests, release verification and evidence

- [ ] Pending — Keep existing checks passing: `test-product-styling`, `test-our-story`, `test-mobile-storefront`, `test-editorial-polish` and **image ownership**.
- [ ] Pending — Add targeted regression tests for image loading/fallback, gallery transitions, badge evidence, navigation labels and any changed copy.
- [ ] Pending — Run **`npm run audit`** and **`npm run typecheck`** after each meaningful implementation PR, plus dependency checks currently required by CI.
- [ ] Pending — Manually verify the **image loading/fallback** and **full mobile navigation** using a browser/device with real network inspection and failure simulation; record screen sizes, evidence and unresolved limitations.
- [ ] Pending — Review screenshot/mobile/desktop differences, major accessibility failures, image loading and relevant performance metrics before production claim.
- [ ] Pending — Merge only when CI passes; verify production deployment status separately and avoid claiming a live fix until deployment succeeds.
- [ ] Pending — Report each major milestone concisely with changed files, tests, PR and remaining blockers.

**Acceptance:** Green CI plus truthful, documented manual/browser verification for critical behaviors.

---

## Implementation order and ground rules

**Order:** Create this document first → **1. image loading reliability** → **2. image/card variety** → **3. truthful badges** → **4. mobile navigation** → **5. homepage copy** → **6. real proof** → **7. styling guidance** → **8. finish** → **9. full verification**. Run relevant checks for each section as you progress.

- [ ] Pending — Maintain these checkboxes as the authoritative status tracker; mark specific tasks complete only when actually verified.
- [ ] Pending — Preserve the existing Next.js architecture, routes and API contracts unless the numbered task demonstrably requires a safe change.
- [ ] Pending — **Never change a product's name, photo, material, price, stock, order, return rights or commercial guarantee based on a guess.** No cross-SKU photo or title swaps; same-product re-verification before any media substitution.
- [ ] Pending — Never create fake reviews, fake orders, fake delivery urgency, unverified Bestseller/New or fabricated product angles.
- [ ] Pending — Prefer small, reversible, reviewable PRs; run tests and check deploys; keep unfinished photo collection/device QA flagged honestly.

## Progress notes

_No implementation tasks have been marked completed in this plan yet. Add date, evidence, changed paths, tests, PR and deployment status after each verified section._
