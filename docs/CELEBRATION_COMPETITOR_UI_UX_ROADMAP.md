# Celebration — Competitor-inspired E-commerce UI/UX Roadmap

**Approved direction:** Combine **GIVA/Palmonas jewellery shopping** with **IGP/BoxUp gift-hamper shopping**. Work on the existing Next.js store, not a replacement or unrelated design plan.

**Source:** Owner-supplied competitor-comparison and homepage/prototype conversation dated **12 October 2026**. This document supersedes the two unrelated "final improvement / AI-feel removal" plans. It records the actual three-phase UI/UX plan, not fabricated acceptance or a new implementation authorization.

**Brand:** premium, approachable, mobile-first; cream, burgundy, soft/champagne gold.
**Commercial position:** affordable jewellery + personalized gift hampers + simple shopping.

## Non-negotiable implementation rules

- **P0:** exact SKU-to-photo-to-name pairing; never borrow another product's image or invent items, variants, reviews, returns, stock, warranties, or delivery slots.
- Preserve product prices, inventory, cart, checkout, payment, customer accounts, order tracking, courier/shipping operations, and original product media unless the owner explicitly asks otherwise.
- Keep jewellery browsing and gifting flows distinct. Ready-made hampers may be merchandised only when genuine ready-made inventory, contents, prices, and photos have been supplied.
- Screen design approval and final real-mobile/desktop review are separate from successful source CI and VPS deployment. Do not call unobserved screens visually perfect.
- Change one approved section at a time. Avoid unrelated card redesigns.

## Phase 1 — Homepage Redesign

**Original mobile flow:** compact logo/header/account/cart; full-width search; small navigation; dual jewellery/hamper hero CTAs; circular Shop by Category; two-in-row jewellery discovery; Shop by Occasion; Build Your Own Hamper; Ready-Made Hampers when genuine stock is available; Trust, tracking, support and footer.

**Original desktop concept:** editorial hero with two shopping entry points, category shortcuts and up to four jewellery products per row; 1240px maximal container as the proposed design target.

**Current source/deployment assessment (2026-10-12):**
- **Implemented, visual acceptance pending:** Header/search/cart/account, jewellery+hamper hero, compact category rail, seven currently installed owner-supplied R2 category images, four genuine mixed-SKU featured product cards, occasion rail, premium budget selection and the existing trust/footer/navigation.
- **Owner's updated final decision (2026-10-12):** **Do not keep the previously requested horizontal-swipe featured cards.** Follow the **original proposed competitor design** for “Take a closer look” / jewellery discovery: **two product cards side by side on phones and four in a row on desktop**, a regular wrapping grid rather than swipe navigation. Keep each product's real image/name/price/cart and make changes only to this featured area.
- **Important deferred task — LAST STEP OF PHASE 1:** The owner explicitly requested that **the existing seven “Shop by Category” round-card images be replaced at the very end of Phase 1**, not during the featured-grid change or the intervening header/mobile/desktop QA. Until that final Phase 1 image task, **keep the current round shape, category links and images untouched**. At the last step obtain/use the owner's desired correct category-wise artwork, verify each category assignment visually, then update only those images. Do not silently recycle old poster crops.
- **Not shipped due to absent real catalogue inventory:** dedicated standalone-earrings category cards or **Ready-Made Hampers** cards/listings. Never invent them.
- **Phase 1 mobile header implementation:** homepage now mounts the existing user-gesture-driven navigation collapse, with a dedicated document-flow spacer to prevent header-height layout jumps. At <=700px a downward vertical scroll collapses search/navigation (logo/account/cart remain); real upward scroll, keyboard focus and return to top reveal them. Horizontal category gestures are ignored; desktop is unchanged. **Real mobile browser visual acceptance remains pending.**
- **Phase 1 desktop real-browser QA (2026-10-12):** Automated live Chromium screenshot + geometry coverage added for **1024, 1280, 1440, 1920px**. First pass: HTTP 200 on all four, no viewport overflow, four real featured cards on a single desktop grid row, all seven current category images, visible original navigation, both hero CTAs and actual product details, no HTTP/JS errors. The initial tool falsely flagged the hero title due to font ascenders/descenders exceeding `clientHeight` even though the title was visually complete with `overflow:visible`; its clipping detection now flags only real hidden/clip overflow. Desktop snapshots visually reviewed in part (hero, header, featured, categories); not a claim of pixel-perfect human acceptance.
- **Remaining:** Final manual review of responsive visual polish and homepage interaction/navigation tests. Verify the mobile header shows/hides without flicker on actual Android/iOS (user reported lag resolved after the last optimization). **Replace Shop by Category circle imagery only at the LAST Phase 1 step**, when the owner supplies/approves the new photographs; don't change them early.

## Phase 2 — Jewellery Listing + Product Detail

**Competitor references:** GIVA detail clarity and gifting; Palmonas wishlist, sorting and discovery; Rubans compact mobile filters; Myntra browse ergonomics.

**Required shopping experience:**
- Visually consistent mobile **two-column jewellery product cards**, exact-SKU product photos, accurate names, prices, easy add to cart.
- Filter by category and price, sort, clear active filters, search and browse category shortcuts; accessible mobile filter/sort panels.
- Product detail: authentic photo gallery, visible price and stock, reliable Buy/Add to Cart, **delivery estimate by entered pincode before checkout**, optional gift-wrap only if actually supported, care/styling details, genuine reviews.
- Wishlist/favorites only if a working save/retrieve experience is implemented, not a decorative heart icon.

**Current source assessment (2026-10-12):**
- **Implemented in code:** jewellery listing search/category/sort/price controls, catalogue card display, SKU product detail, gallery, stock-aware add-to-cart, verified reviews when eligible, styling/care and checkout pincode serviceability.
- **Not established/unfinished:** operational customer **wishlist**, separate pre-purchase **product-detail pincode ETA** (checkout serviceability is not a product-page ETA), a dedicated product-page **Buy Now** shortcut, optional gift-wrap as a supported order option, and 2–3 additional same-SKU product-angle images where real assets exist.
- **Must verify in real browser:** 320–430px and desktop card layout; filter dialogs, gallery swipes, image error/fallback, complete purchase journey and SKU/photo identity. Two distinct necklace SKUs `celebration-necklace-030` and `-031` share identical rendered source bytes and await physical-reference review; never guess replacements.

## Phase 3 — Gift Hampers + Custom Hamper Builder

**Competitor references:** BoxUp/Confetti build-your-box product selection and pricing, IGP/FNP occasion and recipient discovery and practical fulfilment.

**Required two separate shopping paths:**
1. **Shop Ready-Made Hampers:** stock-backed prepared bundles with accurate photo, included products, price and direct purchase. The original plan explicitly prohibits fake listings.
2. **Build Your Own Hamper:** pick a budget, choose **actual included products**, see live remaining budget/selected items, optionally add a gift message and supported wrapping/personalization, enter recipient/delivery information, then pay. Occasion/recipient discovery assists navigation.

**Current source assessment (2026-10-12):**
- **Implemented in code and previously deployed:** 12 live hamper budget tiers, occasion choice, premium selection recap, address/delivery fields, optional message, account, payment and post-order tracking UI. The currently rendered builder **chooses a budget and occasion, then Celebration curates the item mix**; it proceeds to delivery and payment. A `ProductStep` component exists but is **not rendered** in the current `HamperBuilder` flow.
- **Incomplete compared with BoxUp/Confetti "Build Your Own" concept:** customer-directed product selection and quantity, truthful **live itemized mix/price summary** with budget constraints, and clearly exposed supported personalization/wrap options. Implement only after owner approves whether **curated** and **customer-selected** modes should coexist.
- **Not shipped:** Ready-Made Hampers storefront/catalog because no separately verified ready-made inventory/contents/photos are evidenced by the current 89-SKU jewellery catalogue.
- **Delivery date/time slot caveat:** include only what real logistics service supports; do not copy competitor promises without operational evidence.
- **Remaining:** end-to-end real hamper order and customer-selected item/stock/inventory test coverage if the optional self-build flow is introduced; mobile/desktop visual sign-off.

## Recommended remaining sequence, confined to this plan

1. **Phase 1 acceptance:** Use the owner's **original proposed 2-column phone / 4-column desktop featured grid** (NOT swipe). Verify mobile header/scroll behavior, remaining homepage navigation, mobile and desktop layout with actual screenshots. Fix only verified defects and preserve product/cart logic. **LAST task before Phase 1 sign-off: replace the seven Shop by Category circle images category-wise** after the owner approves the new photos; do not change them early.
2. **Phase 2 completion:** Working wishlist; pre-checkout pincode delivery estimate backed by actual service data; clearer buy-now path if desired; photo/gallery/product-card QA. Respect privacy and existing cart/checkout.
3. **Phase 3 specification decision:** Owner chooses curated-only vs curated **and** customer-selected hampers. Add honest item selection/live summary only for real stock and supported fulfilment.
4. **Ready-made catalog** only after owner supplies source images, contents, actual inventory and pricing; then create distinct entry point.
5. **Final QA:** Real device, accessible controls, API/network/error states, no misleading stock, media, reviews, delivery promises or policies.

**Status legend:** An implemented source/UI component does not imply field testing or exact adherence to the preview. The referenced Vercel homepage was a **sample-data prototype**, not proof that a production feature is complete.

## Competitor patterns and design priorities

| Priority | Pattern | Evidence/guard |
|---|---|---|
| P0 | Exact product ID, name and image | Same-SKU photos only |
| P1 | Compact homepage and jewellery grid | 2 columns on mobile, 4 on desktop; no featured swipe |
| P1 (Phase 1 last) | Category circle image replacement | Deferred by owner until after all other Phase 1 work |
| P1 | Consistent jewellery listing cards, sorting, wishlist | Functional, not decorative |
| P1 | Product-page pincode ETA | Actual serviceability and achievable delivery dates |
| P2 | Separate ready-made/custom hamper entry | Real catalogue only |
| P2 | Selected items and budget remaining | Backed by actual stock and pricing |
| P2 | Optional gift note/wrap | No unsupported feature claims |
| P3 | Occasion/recipient discovery | Labelled with real categories |
| P3 | Genuine verified reviews/media | Verified orders and moderation only |

**Scope of this plan:** Homepage, Jewellery Listing + Product Detail, Gift Hampers + Custom Hamper Builder. About Us, extensive SEO, unrelated old AI-polish checklist and feature expansion are not phases of this competitor UI/UX roadmap.
