# Celebration — Phase 1 Homepage UI/UX Blueprint (approval draft)

**Version:** 1.0 · **Date:** 12 October 2026 · **Status:** DESIGN REVIEW ONLY — no production UI, product data, API or checkout changes.
**Positioning:** Affordable jewellery + personalised gifts. Draw on GIVA/Palmonas for easy product shopping and IGP/BoxUp for occasion- and budget-led gifting, **not** a copy of another store.
**Visual identity:** Celebration burgundy, warm ivory/cream, muted champagne (non-metallic), human editorial copy. Preserve existing tagline **“Mharo Surprise, Thari Smile.”**

## 0. Verified baseline from current `main` source

- `app/page.tsx` resolves the **live catalog via `getCatalogConfig()`** and verified badge logic, or falls back to `defaultCatalog`. Homepage design must use the same live pipeline.
- `features/home/Storefront.tsx` currently renders a moving TrustStrip, StorefrontHeader, Hero, four benefit cards, conditional real order proof, HomeCatalog, and StorefrontDiscovery.
- `HomeCatalog.tsx` already renders category shortcuts, four selected product cards, and two large, near-duplicate campaign panels for Jewellery and Hampers. No need for a third giant card.
- `StorefrontDiscovery.tsx` owns selectable genuine hamper tiers, occasions, and a lazy builder. Preserve event targets, state and `#budgets`, `#occasions`, `#builder`, `#custom-request`, and `#trust` anchors; preserve `LazyStorefrontTail` scroll/hashing behavior.
- The **checked-in fallback catalog** has 89 products in 5 exact categories: Premium Anti-Tarnish Necklaces (22), Trending Necklaces (28), Necklace + Earrings Sets (15), Gold-Plated Bangles & Bracelets (12), Adjustable Rings (12).
- **Not proven in the seed:** a standalone earrings category, separate bracelets and bangles product collections, or inventory of prepacked ready-made gift hampers. The live DB might differ: populate a shortcut only from currently active matching products, and hide unverified categories. A dedicated ready-made hamper section is **conditional on actual purchasable inventory**.
- 12 checked-in hamper budgets range from **₹299 to ₹5,000**. Avoid showing twelve giant budget tiles on the home screen; only display genuine active example tiers/quick shortcuts and keep the complete choice in the builder.
- Live product name/photo mapping has been an owner-reported issue. **P0 data integrity:** no image/title swaps, no generated product details, no cross-SKU source. Before implementing a product-first hero or category shortcut, verify the active DB product ID/name/primary image/stock relationship and track mismatches separately.
- Header currently includes a large desktop search and 6-link mobile nav; earlier hide-on-scroll behavior was fixed to prevent jank. Preserve account/cart/search access and 44px+ controls.

## 1. Final proposed mobile wireframe (design only, target 390px)

```text
┌─────────────────────────────────────────┐
│ Celebration                  [Account][Cart] │  logo row: 60–64h
├─────────────────────────────────────────┤
│ [ Search jewellery & gift hampers    🔍 ] │  46–48h field
├─────────────────────────────────────────┤
│ Jewellery   Hampers   Occasions    Track › │  slim swipeable nav
├─────────────────────────────────────────┤
│             CAMPAIGN PHOTO              │
│  Jewellery to wear. Gifts to give.      │
│  [ Shop Jewellery ]  [ Build a Hamper ] │  two CTAs, never overlay
└─────────────────────────────────────────┘
   Shop by category               View all →
 [Necklaces] [Sets] [Rings] [Bangles]
 [Hampers]   [All jewellery]
   New / featured from available stock →
 ┌─────────────────┬─────────────────┐
 │  SKU-TRUE PHOTO │  SKU-TRUE PHOTO │
 │  verified name  │  verified name  │
 │  ₹ actual       │  ₹ actual       │
 │  [Add to cart]  │  [Add to cart]  │
 └─────────────────┴─────────────────┘
   Gifting by occasion             →
 [Birthday] [Anniversary] [For her] [Just because]
   Build a hamper in 3 steps
  1 Choose budget → 2 Choose gifts → 3 Add message
 [ From ₹<live-min> ] [ Browse budgets / Start building ]
   Ready-made hampers (only when real stock exists)
   Why Celebration (2–3 factual points)
   Track Order + support + policies + footer
```

**Component/layout specifications (mobile):**

| Element | Constraint | Content/action |
| --- | --- | --- |
| Screen design baseline | 360, 375, 390, 430px; 320px regression | 16px outside gutters (12px only at 320px), safe-area insets, no horizontal body scroll |
| Initial header | Logo/account/cart row 60–64px, next search row 46–48px, lean navigation 36–40px | Existing account/cart links and `/jewelry?view=all&q=` search; no giant 3×2 home nav |
| Sticky/scroll | Compact single brand/account/cart row after actual downward scroll; full search accessible when back at top | No scroll-anchoring feedback/flicker; 44px icon buttons; keyboard focus restores controls |
| Hero | ~250–310px depending text/photo aspect, never full-screen | Existing campaign art only until correct original product photo checked. Two unambiguous CTAs with contrast ratio >=4.5:1 |
| Category shortcuts | 4-per-row at 390px, 3-per-row at 320px if tap text cannot fit; 68–76px image circle | Data-generated taxonomy; consistent 1:1 crop; labels below; *never* invent a category or use another SKU's photo |
| Featured cards | Strict 2 columns (>=320px); 8–12px gap; cards 100% equal width | Actual product image, full valid product name (up to 3 visible lines; don't rewrite/cross-match), live ₹price, real stock and action |
| Product card imagery | 1:1 on consistent off-white backdrop; no model photo invented | Same SKU evidence. Neutral branded fallback if missing. Sold-out button disabled based on real stock |
| Occasion shortcuts | 2×2 tiles or 4 small chips; no giant banner | Only configured occasions; choosing one should call the *existing* builder event/flow |
| Build hamper | Compact process explainer + actual live minimum tier, 1 dominant CTA | Real builder, not a fake mock checkout. Keep `#budgets` and builder anchors intact |
| Ready-made | **Conditional; hidden if zero verified individually purchasable ready-made hampers** | Never show an empty/imaginary grid as live product stock |
| Factual trust | Max 2–3 compact factual points, plus support/tracking/footer | No synthetic five-star reviews, order counts, fake savings, guaranteed delivery time or warranty |
| Footer | Collapsible informational group permitted | Keep legal/policy/privacy/order tracking and customer support reachable |

**Above the fold at 390×844:** logo/search/navigation + the hero and both primary shopping CTAs. First actual category row should begin near the fold; no oversized banners, full-height sticky blocks or cookie overlays covering cards.

## 2. Desktop wireframe (1440px target)

```text
┌──────────────────────────────────────────────────────────────────┐
│ Logo     [Search gifts / rings / necklaces ............] Account Cart │
│ Jewellery   Hampers   Occasion   Track   About              │
├──────────────────────────────────────────────────────────────────┤
│ Hero: left 45%          │ Campaign image: right 55%          │
│ Headline / microcopy    │ One calm photo, not 4 crowded cards │
│ [Shop Jewellery]        │                                     │
│ [Build a Hamper]        │                                     │
├──────────────────────────────────────────────────────────────────┤
│ Shop by category: 5–6 uniform round thumbnails                  │
├──────────────────────────────────────────────────────────────────┤
│ Featured jewellery / real SKUs                      View all →  │
│ [SKU/card]  [SKU/card]  [SKU/card]  [SKU/card]                    │
├──────────────────────────────────────────────────────────────────┤
│ Gift for occasion: 4 small tiles  │ How to build a hamper       │
├──────────────────────────────────────────────────────────────────┤
│ Active budget shortcuts + real builder entry                    │
├──────────────────────────────────────────────────────────────────┤
│ Ready-made hampers (conditional) | proof / trust / footer       │
└──────────────────────────────────────────────────────────────────┘
```

**Desktop exact layout:**
- Container max-width **1,240px**, outside margins auto; horizontal padding 32px at 1024px.
- 12-column layout. Desktop hero 45/55 split; min-height 400px, max-height 500px. Text block max-width 460px, body 15–16px, primary heading 52–64px.
- Categories 5–6 equally sized thumbnails, ~92–110px round media. No category photo chosen from a different SKU.
- 4 actual active SKU cards per row on desktop (3 at 900–1199px, 2 at <=700px).
- 24–32px gap between related content, 56–80px vertical breathing space between main sections, fewer decorative full-width panels.
- Mobile and desktop copy, product ordering, prices and navigation destination must agree.

## 3. Interaction and content contract

1. **Hero:** “Jewellery to wear. Gifts to give.” CTA 1 → `/jewelry?view=all`; CTA 2 → `/#budgets` or existing builder-open event, preserving native anchor functionality.
2. **Search:** single search form; `/jewelry?view=all&q=<query>`; focus and on-screen keyboard should not obscure it.
3. **Category chips:** filter by **actual live category identifiers** via existing `/jewelry?view=all&category=<id>`. Merge subcategories for visual discovery only when supported by actual backend filter semantics—otherwise show faithful individual category links.
4. **Product card:** `product.id` links, genuine product.name/primary photo and actual sale price/stock from the same record. Add-to-cart remains existing component. Never let a redesign "fix" wrong names by guessing.
5. **Wishlist:** not part of Phase 1 unless genuine persistent wishlist support is scoped and tested later in Phase 2; do not display a dead heart button now.
6. **Occasions:** only existing `initialCatalog.occasions`; click must open builder with the selected occasion, not merely a dead visual chip.
7. **Budget:** link to working `#budgets`; use actual min active tier in copy. Preserve all active selections, step events, order form and payment.
8. **Real proof:** only existing validated paid+delivered cohort and moderated verified reviews. No fake urgency, five-star decoration or shipping dates.
9. **Mobile header:** maintain the separate tested gesture behavior; do not introduce another competing scroll listener.
10. **Accessibility:** labelled focus, 44px minimum touch controls, reduced motion, readable 12–16px body, 16px search input on iOS, keyboard reachable category and filters.

## 4. Detailed homepage section order

**Mobile:** Header → Compact Hero → Category shortcuts → Featured jewellery → Occasion finder → Hamper builder entry → Optional verified ready-made hampers → Two/three trust facts → Support/Track → Footer.

**Desktop:** Header → Split Hero → Category row → Four-up jewellery → Side-by-side occasion/builder education → Budget entry → Conditional ready-made hampers → Factual proof/footer.

The current big Jewellery and Hamper campaign tiles become **small functional entry points**, not another giant repeated two-panel section. The moving multi-item TrustStrip should be replaced or reduced to one unobtrusive truthful sentence at most; no animated marquee on mobile.

## 5. Existing code mapping (IMPLEMENT ONLY AFTER APPROVAL)

| Existing path | Intent |
| --- | --- |
| `features/shell/StorefrontHeader.tsx` / HeaderScrollBehavior | compact header without losing account/cart/search and accessible nav |
| `features/home/Hero.tsx` | responsive single hero with two CTAs and correctly sourced art |
| `features/home/HomeCatalog.tsx` | actual category shortcuts, real product cards, shrink duplicated giant campaign art |
| `features/home/Storefront.tsx` | precise section composition, remove redundant benefits layout |
| `features/home/StorefrontDiscovery.tsx` / `BudgetSection.tsx` / `OccasionRail.tsx` | shorter surface, retain all event and builder contracts |
| `features/home/LazyStorefrontTail.tsx` | preserve hash/scroll lazy-loading and existing builder |
| `features/catalog/CatalogCard.tsx` | use truthful SKU content and consistent compact responsive treatments |
| New **scoped** CSS | responsive 320–1440; avoid global regressions on /jewelry, /account and /track |

## 6. Design and launch QA gates

**Before coding:** owner approves section order, compact header, hero style and conditional ready-made listing. Check active database SKU/name/photo mappings and list any mismatches; this is not a visual-only problem.

**Before merge:** verify original SKU/card name-photo, stock and sale price; 320/360/375/390/430/768/1024/1440 screenshots; 2-up mobile and 4-up desktop cards; actual mobile scrolling and compact header; keyboard/focus; filters; cart/checkout; existing builder `#budgets` and `#occasions`; eligible reviews; no unsupported gifts or trust claims.

**Release:** one reviewable UI implementation PR only after design approval and passing tests. This document/branch must not deploy homepage changes.

## 7. Decisions for owner sign-off

- [ ] **A.** Approve **one compact hero** with Jewellery + Build a Hamper as dual primary options, not two huge promotional banners.
- [ ] **B.** Approve dynamic round category shortcuts from **verified active inventory** (do not add standalone Earrings or prepacked Hampers until genuinely in catalog).
- [ ] **C.** Approve 2-column mobile / 4-column desktop **same-SKU product grid** and compact order-specific cards.
- [ ] **D.** Approve **Occasion finder → Budget → existing hamper builder**, no new imaginary shopping API.
- [ ] **E.** Approve only verified inventory/trust and keep data/auth/payment/tracking intact.

**No code modifications, image generation or website deployment are part of this design-only plan.**
