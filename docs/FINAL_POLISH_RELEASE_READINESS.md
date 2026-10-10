# Celebration final-polish combined release — Task 7, Task 8, Task 9

**Recorded:** 2026-10-10 · **Source of truth:** [FINAL_POLISH_AND_AI_FEEL_REMOVAL.md](./FINAL_POLISH_AND_AI_FEEL_REMOVAL.md)  
**Staging PR:** #91 · **Target:** one final production deployment, not one per task.

## Task 7 — Product-level styling (code complete)

A reviewed, deterministic resolver handles the five actual seed categories:
- **15 Necklace + Earrings Sets:** Wear as a matching set with a saree/suit, or style the necklace and earrings separately. Never infer stone shape, finish or weight.
- **50 Necklaces:** Suggestions for a simple neckline, traditional outfit or layering only when comfortable. No guessed length or alloy.
- **12 Adjustable Rings:** Outfit pairings and spacing for multiple rings. No fabricated ring diameter.
- **12 Bangles / Bracelets:** Pairings for kurta, saree and watch, without inventing clasp or wrist size.
- **Earrings (future category):** Specific single-pair styling. The seed currently contains no standalone earring category SKU.
- **Unknown / gift-only:** Honest *Gift ideas* instead of jewelry fit or care guidance, even if a marketing product name happens to contain a jewelry term.

The original **89 SKUs are still owned by exactly their same original photo sources**; this task changes only contextual advice. Care text is limited to handling, removal before water activities, wiping and storage, with no invented guarantee. A confirmed jewelry category always outranks potentially misleading title words; name-only fallback is allowed only when category is blank.

Verification: `scripts/test-product-styling.mjs` exercises the real TypeScript resolver, all 89 SKUs and future synthetic set/necklace/ring/wristwear/earrings/gift cases; CI runs it as part of `npm run audit`.

## Task 8 — Storefront finishing (code complete, device sign-off pending)

- Existing **locally bundled Bodoni Moda/Inter** for meaningful heading/body hierarchy; scoped `styles/storefront-final-finish-task8.css` refines spacing, line wrapping, focus visibility, calm borders and product-detail advice.
- Preserves Task 2's three honest framing treatments without altering photos or card/order IDs. Genuine badges remain evidence-backed.
- **Product gallery:** true additional SKU images only, previous/next, thumbnails and 44px arrow controls; **horizontal swipe** with 55px minimum and vertical-gesture rejection, and **ArrowLeft/ArrowRight** support when the gallery is keyboard focused. No imaginary images or cross-SKU substitutions.
- **Mobile:** 44px cart/quantity/filter targets, 48px gallery thumbnails, bottom safe-area clearance for sticky buy bar, Esc/focus-trapped filter sheet, responsive typography at <=700 and <=360px. Touch handler uses `touch-action:pan-y` so a vertical page scroll must not cycle photographs.
- **Human-focused copy:** “Available to order individually”, “For a custom hamper”, “More from this collection” replace lingering generic little/thoughtful descriptions; empty collection displays factual text.
- **Existing source-surface scan** already guards against AI credits, dummy reviews, Lorem Ipsum and obvious incomplete template filler. Task 9 adds an additional consumer entry-point check. Embedded words permanently flattened into a third-party photo are **not inspectable through textual code scanning**; corresponding photo clean-up remains a Task 2 asset dependency.

## Task 9 — Release verification and honest status

**Automated, source-level tests:** 
`test-image-loading-reliability`, `test-product-card-presentation`, `test-verified-catalog-badges`, `test-real-social-proof-task6`, `test-final-mobile-navigation`, `test-homepage-human-copy-task5`, `test-product-styling`, `test-our-story`, `test-mobile-storefront`, `test-editorial-polish`, `test-final-storefront`, `test-image-source-ownership`, `audit-catalog-image-ownership --dry-run`, and **`test-final-release-task8-9`**. All are part of `npm run audit`. The GitHub **Verify Celebration PR** workflow additionally runs `npm audit --omit=dev` and `npm run typecheck`.

**Hard acceptance checks still requiring visual/production evidence:**

| Check | Verifiable source/code status | Remaining independent confirmation |
| --- | --- | --- |
| White-box intermittency | Loader has local branded fallback, decode and timeout handling | Actual reported product URL, device, HTTP/response/content-type and screenshot |
| 89 photo compositions | Every original source and SKU mapping accounted for | Visual scene inspection to classify model/composite/product-only; originals for new angles |
| 030/031 photo duplication | Kept unchanged to avoid cross-SKU replacement | Physical SKU match before any image change |
| Mobile nav and sale cards | Source selectors and text/links verified | Real 320/360/375/390/430 mobile screenshot, taps, iPhone Safari, Android Chrome |
| Badge order/review data | Database-query semantics and auth verified in code | Read-only live evidence and sandbox approve/reject/invalid-order integration |
| Gallery swipe/keys | Source and TypeScript code tests | Actual swipes, vertical scroll, focus and gestures on real phone |
| Checkout/cart/filter | Existing tests retain order/payment APIs | Staged end-to-end buyer journey, modal keyboard and touch |
| Image speed/Lighthouse | Responsive files and prioritization in code | Real mobile Lighthouse metrics, R2 response headers and 403/404 tests |
| Product labels/guarantees | No SKU assets/prices/material changed | Operator review of physically supplied merchandise |

**Important:** The manual rows must stay `Pending` until actual browser/hardware evidence is collected. Do not mark all source-of-truth checkboxes `[x]` just because CI is green or represent the site as visually signed off. No static script can establish whether a third-party photo embeds unwanted logo/mockups or physically represents a SKU.

## Single-deployment policy

Changes for Tasks 2–9 are staged together in **PR #91**. Task 1 image reliability was already merged before the owner instructed batching. **Do not perform further individual production deploys.** One final main merge triggers the single production GitHub Actions workflow; it builds with production environment and includes a PM2 rollback on health-check failure. Do not claim production changed until GitHub Actions and public health succeed.

**Release is not signed off while critical visual and same-product photo checks remain unresolved.** If owner prioritizes release of code-only improvements, make that explicitly a limited scope release and keep outstanding asset/device items documented; do not falsely call the full plan complete.
