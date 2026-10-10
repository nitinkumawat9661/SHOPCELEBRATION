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
- [x] Done (implementation + automated test; production device QA pending) — Implemented decode-aware loading, image-key isolation, pending/error states, responsive-source retry, 16s/10s stalled-request fallback, and priority for the main image.
- [x] Done (implementation + automated test; production visual check pending) — Inline HTML branded artwork is always present behind each image; a local bundled SVG is the final network source. Even if that SVG fails, styled text remains instead of a white box.
- [x] Done (implementation guarded by existing source/SKU tests) — Responsive candidate → same hosted main → same-product original → local placeholder. No catalog source, photo, ID, image ownership or fallback mapping was changed. Existing 4-source checks remain.
- [ ] Pending — Support **1 genuine main image + up to 2–3 additional genuine product-angle/close-up photos** per product where those actual same-SKU assets exist. Implement graceful 1-image galleries when no extra images exist; **never fabricate angles or use other products**.
- [ ] Pending — Test initial load, rapid thumbnails, previous/next, direct links, source change, 404/403/timeout simulation and no-network mode on desktop and mobile. Verify the actual visual outcome, not only code assertions.

**Task 1 progress (2026-10-10):** Implemented loader/gallery/card-sprite safeguards in `SafeCatalogImage.tsx`, `ProductGallery.tsx`, `CatalogCard.tsx` and `styles/catalog-image-reliability.css`. Added real candidate-builder regression coverage in `scripts/test-image-loading-reliability.mjs` and a detailed manual reproduction matrix in `docs/IMAGE_LOADING_QA_TASK1.md`. **Not yet proven:** the exact production 404/timeout cause, actual device screenshots/network status, and availability of genuine second/third/fourth SKU photos. Do not claim all-white-box incidents resolved until production browser/network verification. The remaining reproduction/diagnosis, media-asset and manual-browser checkbox items remain pending.

**Acceptance:** A product image is visible or a clearly branded fallback is visible across tested paths; gallery switching is reliable; image-to-SKU mapping stays exact.

## 2. Product cards and photography — remove template-like repetition (SECOND)

- [ ] Partially audited — source inventory completed for all 89 SKUs (`docs/PRODUCT_IMAGE_ASSET_INVENTORY_TASK2.csv`): 22 first-party PNG + 67 R2, exactly one catalog photo per SKU; **visual inspection of embedded composite artwork and actual viewpoint still pending**, no false classifications.
- [ ] Partially implemented — cards now use restrained visual media framing and full-image contain; genuinely different clean/on-model/lifestyle photos are **not present as separately verified same-SKU assets in the seed**. Photo replacement remains pending authentic asset review; no fabricated angles or semantic claims.
- [x] Done (code/source safeguards) — no product image pixels, photo links, names, inventory, descriptions, guarantees or source ownership modified. All 89 photos flagged for visual classification and authentic same-SKU asset collection; potentially shared rendered bytes for 030/031 remain on hold.
- [ ] Implementation complete; manual QA pending — three deterministic, subtle card-frame variants (`clean`, `paper`, `folio`), truthful badges moved below photographs, `object-fit:contain` to avoid cropping, restrained hover and responsive 320–430px styling; requires screenshot/device sign-off.
- [ ] Pending — Review product cards at 320/360/390px and desktop; compare card thumbnail to detail-page photo and title for every affected SKU.

**Task 2 progress (2026-10-10):** [Photo inventory and current limitations](./PRODUCT_IMAGE_PRESENTATION_AUDIT_TASK2.md) and [89-SKU CSV](./PRODUCT_IMAGE_ASSET_INVENTORY_TASK2.csv) added. Code updated in `CatalogCard.tsx`, `lib/domain/catalog-card-presentation.ts`, `styles/product-card-natural-presentation.css` and `scripts/test-product-card-presentation.mjs`. **Not visually verified:** photo composition/model vs product-only shots, 320/360/390 desktop screenshots, or the duplicate image pair. **Owner-requested deployment policy:** do not merge/deploy each task; accumulate tested work on the feature branch for one final release.

**Acceptance:** A varied, credible collection presentation from actual owned images, with no identity mismatch or repetitive decorative overlay introduced by the site.

## 3. Dynamic and truthful badges/discounts

- [x] Done (source audit + code) — audited 89 legacy badge strings, including 65 old 25%-off labels; compute discounts only from safe positive integer MRP/sale price, keep genuine MRP displayed, suppress uniform `Save ₹XX` copy.
- [x] Done (evidence-gated code; live actual badge mix pending) — server queries paid+delivered recent order records for category-leading Bestseller, published catalog revisions for actual New, live stock + operator intent for Limited, valid price gap for discount; otherwise no badge. Current database evidence has not been examined, so do not promise every badge type will display.
- [ ] Code complete; mobile visual QA pending — added restrained type-specific colors, readable wraps and safe badge placement below card photos, with concise product detail badges.
- [ ] Automated CI passed; real-device QA pending — PR #91 run 38033173093 passed npm audit/typecheck; expanded individual-sale and verified badge evidence tests cover unverified admin labels, stale/future publication, category rank, stock/savings, and mobile CSS. Actual browser wrapping/truncation still needs physical verification.

**Task 3 progress (2026-10-10):** [Evidence model, verified SQL inputs, pricing design and QA limitations](./VERIFIED_BADGE_SYSTEM_TASK3.md). New source: `lib/server/product-badge-evidence.ts`; upgraded resolver, product price logic, shopper pages, typed transient evidence, badge CSS and CI tests. No invented New/Bestseller values, no changes to catalog prices or product images. **Follow owner's batching rule:** keep PR #91 unmerged; no deployment before all tasks are complete.

**Acceptance:** Badge appearance is varied because the evidence varies, and unsupported labels are absent.

## 4. Mobile navigation and header usability

- [ ] Source mechanism identified; handset reproduction pending — existing mobile `overflow-x:auto` / `white-space:nowrap` could show half a tab at viewport edge, making `Budget` appear `Budg`. Exact phone/browser DevTools proof not yet collected.
- [ ] Code fixed; visual QA pending — replace horizontally clipped nav with all-six-visible grid (3×2 at <=540px; one row at 541–700px), complete wrapping link labels and 44px touch targets. All links/anchors unchanged.
- [ ] Code fixed; device QA pending — brand/action sizing, 44×44px icons, cart badge, full-width 48px search, iOS 16px text to avoid zoom, focus-visible outlines and anchor scroll offset; behavior awaits real Safari/Chrome touch tests.
- [ ] Automated CSS/source tests created; real-device QA pending — 320/360/375/390/430 widths, focus, search/cart interactions, landscape and body overflow to be verified with actual browser. No navigation swipe needed now that all six items are directly visible.

**Task 4 progress (2026-10-10):** `styles/mobile-navigation-final-task4.css` added last in stylesheet cascade; `scripts/test-final-mobile-navigation.mjs` added to standard audit. [Detailed QA matrix and remaining browser verification](./MOBILE_NAVIGATION_QA_TASK4.md). **PR #91 remains unmerged: no incremental production deployment.**

**Acceptance:** All navigation options remain accessible; header controls are clear and tappable without overlap.

## 5. Homepage copy and visual rhythm

- [x] Done (source/copy audit) — reviewed the hero, benefit tiles, featured cards, campaigns, hamper budgets, occasions, promise and request copy; replaced repeated emotional formulas with specific product/ordering language. Brand tagline preserved.
- [x] Done (implementation) — updated hero, category/featured, shop/hamper panels, budgets, occasions, custom request, process benefits, promise and final CTA. Preserved the official “Mharo Surprise, Thari Smile” tagline, real pricing and routes.
- [ ] Code complete; visual QA pending — scoped `homepage-human-rhythm-task5.css` adds measured spacing variations, restrained asymmetric desktop campaign proportions and stacked mobile layout without moving anchors or touching checkout.
- [ ] Pending physical QA — compare staged pre/post screenshots at 320, 360, 375, 390, 430, 768, 1024, 1440px, test hero/title wrapping, 44px CTA touch targets and section rhythm before claiming final quality.

**Task 5 progress (2026-10-10):** [Copy audit, exact updated sections, design rationale and manual-QA matrix](./HOMEPAGE_COPY_AND_RHYTHM_TASK5.md). Implementation spans `Hero.tsx`, `HomeCatalog.tsx`, `Storefront.tsx`, `BudgetSection.tsx`, `OccasionRail.tsx`, `CustomRequestSection.tsx`, `lib/domain/content.ts`, `content/store.json`, CSS and targeted audit checks. Changes are **only in PR #91 staging branch**; keep deployment batched until the end.

**Acceptance:** Concrete, human English copy; no repetitive slogan loop or arbitrary layout randomness.

## 6. Honest social proof

- [x] Done (source review and code safeguards) — existing paid non-cancelled order counts were insufficient for delivered proof; now aggregate only paid AND delivered real hamper orders with >=20 total, >=5 tier, >=20% share, valid active tier and no personal details. No artificial "recently purchased" message is introduced.
- [ ] Code complete; live visual/data QA pending — homepage shows one quiet cohort percentage only with proven delivered-and-paid active-tier evidence, otherwise no social proof. No fake ratings, order ticker or invented activity. Actual eligible production order counts are unknown.
- [x] Done (source + code access protection, live DB QA pending) — review listing, admin approve, public photo and eligibility now recheck matching paid+delivered individual SKU order and active phone-verified account. Public listing also requires admin-approved row with moderation timestamp; original consent and pending-before-approval enforced.
- [x] Done (source/code + automated test) — preserve `Be the first to review this product` only after a successful empty public query; a failed DB request displays `Customer reviews are temporarily unavailable` instead of a misleading no-reviews claim.
- [ ] Automated checks passed; live integration/phone QA pending — source and test code covers tampered/unverified order, wrong SKU, paid+delivered constraints, consent, admin-only moderation, photo authorization, empty vs failed query, 20+/5+/20% cohorts. Staged DB integration and real-device screens still required.

**Task 6 progress (2026-10-10):** Full [source/security audit, evidence thresholds, code changes and pending integration matrix](./REAL_SOCIAL_PROOF_TASK6.md). Automated code checks green in PR #91 run 38034996603. **No live sales/review records were inferred, seeded or modified.** Keep PR staged and defer all deployment to final release.

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
