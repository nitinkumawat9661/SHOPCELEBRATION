# Celebration — Consolidated Project Progress, Decisions, & Delivery Roadmap

**Last updated: 13 October 2026**  
**Project:** shopcelebration.in • Next.js / TypeScript • PostgreSQL • owner-admin tools  
**Repository:** nitinkumawat9661/SHOPCELEBRATION  
**Source of truth:** deployed repository code + completed migration history + owner-confirmed messages. This document is an operations record, not a claim that unimplemented work is ready.

## 0. Decision log — NEVER accidentally reverse these

1. Celebration has **two fundamentally separate jewellery and hamper offers**: retail jewellery purchases (real SKU/stock/personal product photos) and gift hampers.
2. **Curated hamper**: existing live tier-based checkout continues without changed payment/order behaviour. Owner chooses budget and occasion; Celebration decides contents.
3. **Self Build**: **CATEGORY-ONLY selection**, not individual-product selection and **NO SKU-to-category mapping** in hampers. Buyer chooses category (and option, where relevant) and quantity; Celebration chooses exact pieces at fulfilment. Never display a specific retail SKU or imply buyer selected its photo/design.
4. Eight owner-approved Jewellery subcategories (minimalist labels, editable in DB): **Premium Feature Necklaces; Premium Necklaces; Necklace & Stud Sets; Korean Earrings; Indian Trending Earrings; Minimal Rings; Viral Bangles; Korean Bangles**. A **standalone Bangles** category also exists. Viral/Korean Bangles and standalone Bangles internally consume ₹150/unit; other jewellery categories ₹60/unit. These figures are NOT retail selling prices.
5. **Chocolates**: Starter ₹100, Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000, internal budget consumption per selection × quantity. **Snacks** and **Perfume**: Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000. Medium and Large are NOT the same price.
6. **Personalised Photos** consume **₹50 per photo** (quantity 3 consumes ₹150), not one ₹50 fee for the whole selection. Actual photo upload and printing workflow is deferred.
7. Multiple quantities across applicable categories/options/photos are supported by design; later checkout must validate real category availability, hamper budget and packaging, not promise unlimited stock.
8. Any extra customer wishes: final **Anything Else?** optional textarea, editable prompt: “Need anything else? Describe it here. Our team will discuss your request with you.” Don't auto-price custom wishes.
9. **Never display item-level internal budget consumption** to customers, in customer HTML/JSON, previews, UI or analytics. A total advertised whole-hamper tier price is separate. Source-of-truth rates live in Postgres, editable via authenticated admin tools; never hardcode them into storefront components.
10. Do not create fictional chocolate/snack/perfume stock, jewellery names, guarantees, shipping estimates, category photographs or buyer orders to fill UI holes.
11. Keep personalised owner-provided jewellery photos paired with the exact retail SKU; do not use incorrect jewellery images. Self-build category tiles may use *non-SKU decorative abstract art* or typographic treatment only.
12. On homepage, owner wants stable mobile 2-column and desktop 4-card product grids, **not a swipe-only featured product rail**. Circle category imagery is a separately deferred phase-1 polish item (no unapproved substitutions).

## 1. Work completed before this UI milestone

### Phase 1 — homepage / discovery (largely completed)
- Home premium/mobile refinements: hero, header, category discovery, occasions and budget entry.
- Restore stable non-swipe featured retail collection grid; mobile 2 columns, desktop 4.
- Mobile scroll and header stability fixes, approved circle category artwork updates. **Remaining owner-requested task:** final selection of circle category imagery, explicitly deferred.
- Admin marketing content/editorial work and catalogue category visual provenance already documented in previous project files.

### Phase 2 — retail shopping quality (completed code and browser tests; manual ownership QA still separate)
- Customer wishlist: server/account sync.
- Product-detail page PIN-based delivery ETA improvement.
- Browser regression coverage for mobile/desktop, shopping layouts, wishlist, PDP delivery. Continue verifying future deployments do not undo them.
- Previous source-image review noted a possible duplicate visual pair in a necklace collection; requires human verification against original SKU source; NEVER arbitrarily swap images.

### Phase 3 — gift hamper builder: audit and staged backend COMPLETE
- **PR #138:** audit `docs/PHASE3_HAMPER_BUILDER_AUDIT_20261013.md`. Existing builder: tier, occasion, delivery, payment, tracking, packing approval; does NOT select items and only supports *curated* fulfilment. Orphaned old `ProductStep` is NOT authoritative and should not be wired up.
- **PR #139, migration 047:** admin-only staged self-build configuration/categories/options/drafts/future order snapshot, secure GET/PATCH endpoint, live buyer mode hard-disabled and prices hidden.
- **PR #140, migration 048:** owner-confirmed eight Jewellery categories, ₹150 bangle choices, Starter/Medium/Large/Mega size corrections and personalised photos ₹50 EACH.
- **PR #141, migration 049:** final instruction **NO SKU MAPPING for hampers**. Converts jewellery to true category choices, removes the staged SKU mapping table and catalogue mapping field; keeps buyer route disabled. Category-only admin contract `GET/PATCH /api/admin/self-build` returns `version, config, categories, options` to authenticated administrators. Pricing/labels/sort/activation are DB-driven.
- Last successfully shipped backend before this milestone: `e0c9dd89eaef5021011d8fc4604845a316af1df9`, with migration 049 applied in production. Feature currently customer-disabled.
- Existing retail jewellery selling price, catalog, stock handling, courier, order, payment, saved addresses and curated checkout untouched by these migrations.

## 2. This milestone — minimalist **category-only UI design**, FIRST as authenticated preview

### Must implement
- Add an admin-authenticated review page for the visual **category-first Self-Build journey**. The preview must not have payment, ordering, stock reservation, or public customer entry.
- Render actual **current database-driven categories and variant choices** (not duplicate hardcoded jewellery options in React). Fetch privately on server, create a public-safe *sanitized visual-view payload* containing **only** IDs, labels, hierarchy, selection kind and display order; NEVER leak internal `unitBudgetPaise` or budget logic into client props/HTML/network.
- A deliberately quiet, minimalist Celebration-like visual language: neutral off-white/champagne palette, careful serif/sans hierarchy, lots of whitespace, restrained borders, no marketing template cards, no autoplay/video/heavy scroll/parallax.
- Interaction: step/category navigation, jewellery nested 8 choices, separate Bangles, Chocolate/Snack/Perfume sizes, quantity increment/decrement, photo count control and **Anything Else?** textarea; back/change/edit, selected-items summary; keyboard/mobile accessibility.
- Explicit **Preview only — not accepting orders** labeling and non-submitting final state; quantities are an **unsaved browser mock state** and no budget/stock/price promise. User can inspect the visual layout before implementing the real backend.
- Add automated guardrails for privacy, category-only structure, access gate, no payment calls and source stability; verify PR CI, Postgres migration smoke, deployment if possible.

### Non-goals for this preview
- No builder linked into public homepage, no checkout button, no payment mutation, no customer account write, no admin editing UI (separate later work), no photo upload, no inventory promise, no exact SKU/product images, no exposing confidential internal budget numbers, no production order.
- No duplicate "self-build" route in the existing curated `HamperBuilder` until the server quote and stock protections are built.
- No fake "available / in stock" badges, delivery estimates, free gifts or hardcoded prices.

## 3. Roadmap after the visual review (strict ordered slices)

**Phase 3.1 — Review UI preview & freeze approved copy:** Verify 320–430px phones, larger mobile, 768px tablet, >=1280px desktop and keyboard/screen-reader baseline; owner approves category tiles, typography and step order. Category values come from DB; preview must be read-only.

**Phase 3.2 — Admin category controls:** Build actual admin editor over existing secured GET/PATCH API: change names, order, per-category private costs, variant sizes, active status and prompt (never product/SKU mapping). Log/version conflicts; ensure no accidental price leaks into customer view.

**Phase 3.3 — Category/option-level fulfilment inventory:** Model available *units per category and size*, verified packing capacity, photo fulfilment limits; staff-controlled availability. Stock semantics must NOT depend on retail product SKU inventory; explicitly agree how a selected category is fulfilled.

**Phase 3.4 — Authoritative server quote:** Server retrieves current versioned DB rules and units to calculate budget consumption privately; enforce positive quantities, supported category, tier budget, capacity, availability, abuse limits. Public UI can only receive an allowance/error and the **advertised full hamper price**, never item price or invisible-cost information.

**Phase 3.5 — Account-backed draft + photo handling:** Safely persist selected categories/options + quantities and optional notes; photo attachment/upload requires explicit image constraints and private storage; preserve existing delivery preference, authentication and draft flow without rewriting curated orders.

**Phase 3.6 — Transactional self-build order creation:** Snapshot category/size and customer quantities, internal rules version, actual promised contents policy, packing and team approval state; reserve category units atomically, expire/release on failed payment/cancellation; idempotency and concurrent request tests; attach existing payment/tracking system only with separate order type and regression coverage.

**Phase 3.7 — Integrate customer-facing chooser and launch:** Enable buyer flow only when server quote, stock, packing, payment and privacy end-to-end tests pass and owner explicitly approves. Add a separately reviewed database migration to remove `customer_enabled=false` CHECK, never patch around it in JS.

**Phase 4 — Ready-made hampers (independent):** Owner supplies exact content, visuals, price and actual available quantities. Do not fabricate inventory or pack specifications and do not use SKU-based self-build mapping.

**Ongoing reliability:** Site performance, storefront QA/SEO, shipping-order lifecycle/estimated delivery, support/claims, provenance checks, stock freshness and incident/regression follow-up continue independently of self-build.

## 4. Acceptance checklist for this UI milestone

- [x] Requirements and past accomplishments captured in one durable GitHub document **before UI implementation**.
- [ ] UI file(s) created and linked from admin for owner review.
- [ ] Category nesting and option display read **from DB, NOT hardcoded JSON**.
- [ ] Customer-preview component sees no internal-price fields and creates no orders.
- [ ] Multiple category/option/photo quantity UX + notes + summary verified.
- [ ] Responsive styling checked; public curated builder unaffected.
- [ ] CI checks pass and production deploy/health verified.

**Keep this checklist updated after completion**, noting exact commit and remaining risks. Prior-phase documentation and migrations retain historical details; this file is the current top-level checkpoint.
