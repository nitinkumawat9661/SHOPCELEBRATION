# Celebration — Phase 3 Hamper Builder: Source Audit & Safe Implementation Gate

**Audit date:** 13 October 2026 (IST)  
**Scope:** Existing `main` Next.js storefront, catalogue snapshot, builder, checkout, order validation, inventory and fulfilment code. **Source inspection only:** not a live authenticated hamper order, payment, courier booking, manual mobile visual sign-off, or warehouse stock verification.  
**Parent plan:** `docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md`, Phase 3.  
**Status:** Assessment complete; no new self-selected or ready-made hamper product should be offered to buyers until the explicit owner decision and fulfilment gates below.

## 1. Current buyer journey — implemented

1. On the homepage, `features/home/StorefrontDiscovery.tsx` renders the active price-tier rail and occasion rail. Clicking a budget calls `pickTier` → `openBuilder(2, id, true)`: **quick-start to Delivery**, skipping the normal Budget step. Clicking an occasion opens the standard builder at step 1. `StorefrontTail` syncs that preference after draft hydration, and `LazyHamperBuilder` dynamically loads the builder.
2. `features/builder/HamperBuilder.tsx` renders three **actual** states: `BudgetStep`, `DetailsStep`, `PaymentStep`. The quick-start presentation shows **Delivery → Payment**, not a fourth product-selection state.
3. Budget/occasion: `BudgetStep` explicitly tells the buyer **Celebration curates the gift mix**. Checkout shows tier name/price/size/occasion, not committed SKU contents. `OrderSummary` currently labels `tier.maxChoices` as “items”; that is a *limit in the tier model*, **not verified pack contents**, so the copy needs refinement before further merchandising.
4. Delivery: recipient, address, PIN, desired date, optional gift-card message; account saved address and browser draft restore are implemented. `useHamperBuilder` saves a version-3 draft for seven days but intentionally restores the payment step to delivery.
5. Payment: account-based authentication; consent to policies, offer/coupon flow, configured online gateway or manual hamper UPI fallback, order tracking and optional packing-video approval workflow. The actual availability of a specific payment provider must still be verified in production.
6. Separate non-checkout path: `CustomRequestSection` collects an unusual budget and gift preferences for staff review. It is **not** a ready-made bundle or instant builder checkout.

### Catalogue snapshot from `content/catalog.json`

| Finding | Source snapshot |
| --- | --- |
| Active hamper price tiers | 12 |
| Tier prices | ₹299, ₹399, ₹499, ₹699, ₹799, ₹999, ₹1,299, ₹1,499, ₹1,999, ₹2,499, ₹3,499, ₹5,000 |
| Default tier | `t499` |
| Configured tier max choices | 2 through 14 (varies by tier) |
| Occasions | 8, including Birthday, Anniversary, Wedding, Festival, For Her, For Him, Corporate, Just Because |
| Catalogue rows | 89 active jewellery items in 5 category labels |
| Distinct `minTier` values for these 89 SKUs | **299 only** |
| Distinct `points` values for these 89 SKUs | **1 only** |
| Verified ready-made hamper bundle SKUs | **None established by this source snapshot** |

**Important:** `content/catalog.json` is a checked-in source snapshot, not proof of current database inventory, actual packed quantities, supplier cost, reserved stock, or what each buyer receives.

## 2. What is **not** implemented

| Requirement | Finding | Evidence |
| --- | --- | --- |
| Customer can select exact hamper items | **No.** `ProductStep.tsx` exists as an unused component; `HamperBuilder` never renders it. | `HamperBuilder.tsx`, `steps/ProductStep.tsx` |
| Selected item state / quantities | **No.** `useHamperBuilder` returns `selected: []`, `selectedNames: []` at every render; no `onToggle`/quantity state exists in mounted flow. | `useHamperBuilder.ts` |
| Honest itemized preview/remaining **rupee** budget | **No.** `OrderSummary` displays tier, nominal count cap and occasion; `pointBudget` is *not* monetary cost and no basket subtotal/margin calculation is implemented. | `OrderSummary.tsx`, `catalog.ts` |
| Real catalogue eligibility | **Not adequate for a live picker.** All current catalogue SKUs have `minTier=299` and `points=1`; `canSelectProduct` only checks tier, choice cap and abstract points, **not** stock, unit purchasing cost, packing capacity or assortment rules. | `catalog.ts`, `content/catalog.json` |
| Hamper item stock reservation | **No.** `orders/create.ts` only calls `reserveInventoryForOrderWithClient` when `orderType === "individual"`. For a hamper, `normalizeOrderInput` stores selected IDs but populates no line items; even wiring in `ProductStep` would not protect inventory. | `orders/create.ts`, `domain/order.ts`, `inventory.ts` |
| Bundle contents and quantity persisted as a verifiable BOM | **No evidence.** Hamper order stores selected IDs/names but no quantity + frozen item price/cost snapshot or pick/pack bill of materials. | `domain/order.ts`, `orders/create.ts` |
| Gift wrapping choice/charge | **No supported option in checkout model.** `CheckoutData` has a gift **message** but no wrap style, add-on SKU, price, stock or packing workflow. | `builder/types.ts`, `DetailsStep.tsx` |
| Dedicated ready-made hamper storefront | **Not implemented or evidenced**; no validated bundle content/photos/price/stock data. | Catalogue and Phase 3 roadmap |
| Carrier-backed hamper delivery date before payment | **Not equivalent to individual checkout.** `api/payments/create` obtains a Shipway quote only for `individual` orders; hamper date field is a requested date validated as today-or-later, **not a promised slot**. | `api/payments/create/route.ts`, `domain/order.ts` |

## 3. Specific correctness risks

**P0 — Prevent overselling and false item promises.** Do not simply import `ProductStep` into the current three-step wizard. Without actual stock checks, atomic reservations and an itemized order snapshot, a buyer could choose a valid-looking SKU that cannot actually be supplied. Keep the **existing curated flow** stable while designing this separately.

**P0 — Fix commerce semantics before listing bundles.** `maxChoices` and `pointBudget` govern optional picks, not a guaranteed number of curated gifts, pack cost, sale price, or courier charges. Avoid promising **exactly N items** or a list of included SKUs until an operator-supplied bundle/BOM exists. In particular, `OrderSummary` currently reads `tier.maxChoices` as “items”; safer future copy is *“Contents curated for your budget; exact items confirmed before dispatch”*, subject to actual operational promises.

**P1 — Define pricing unambiguously.** A self-selected hamper could be (A) a fixed all-inclusive tier with real eligible item costs and capacity, or (B) a calculated basket + box/packing/shipping charge. Today the tier is simply charged at a configured fixed price; the current `points` model cannot truthfully represent remaining **₹**. Decide and implement *server-side re-quoting* to prevent client-controlled amounts. Do not assume purchase cost = retail selling price.

**P1 — Separate delivery request from delivery guarantee.** `requiredDate` is required in hamper checkout and must not be presented as courier-confirmed arrival. Serviceability/dispatch status needs real evidence, with honest fallback when an ETA is unavailable. Existing packing-video requirement for hampers and customer approval before dispatch should remain intact.

**P1 — Protect the current purchase journey.** Preserve active tiers, saved-address and draft features, verified policy consent, offer quotations, payments, tracking, manual UPI fallback (where configured), admin packing video, and cancellation flow. Do not reuse individual-cart reservation semantics without updating fulfilment.

## 4. Recommended product decision (approval required)

**Recommended: offer two **separate, explicitly labelled** paths:**

- **“Let Celebration curate” (current / default):** choose budget + occasion → enter delivery details + optional gift note → pay; no invented contents and no SKU picker. Keep the existing functionality backward-compatible.
- **“Choose my hamper items” (new / gated):** choose a real available tier or calculated basket → pick exact photos/SKUs and quantities → show an authoritative eligible-item list, stock, per-item contribution or bundle cap, packing/box costs and **actual remaining ₹** → review immutable order contents → delivery → payment. Only expose after backend reservation and order-snapshot support is tested.

**Do not assume this recommendation is owner approval** to activate the second path. The alternative choice is to keep curated-only and avoid a self-select picker entirely.

**“Shop Ready-Made Hampers” is a third, later catalogue path** and requires owner-supplied photographs of *the real prepared bundle*, exact included SKU × quantity, real inventory, actual price, packing dimension/weight, replacement policy and shipping feasibility. Never synthesize bundle images or stock from jewellery listings.

## 5. Safe implementation sequence after decision

1. **Operator data model:** Agree curated-only vs dual mode. Define unit cost/packaging cost, eligible SKUs, stock, max quantity, tier price vs calculated price, shipping and substitution/refund rules. Confirm whether ready-made hampers exist. Require image/SKU ownership verification.
2. **Backend first:** Add explicit `curated`/ `self_selected` identity without silently reinterpreting legacy hamper orders; validate SKU, quantity, actual price and packing constraints *server-side*. Persist an immutable itemized BOM + pricing snapshot and reserve/consume/release inventory transactionally with idempotency and concurrency protection. Preserve existing individual-cart behavior.
3. **Preview then interactive picker:** Expose only eligible in-stock exact-product assets. Provide search/category filters, plus/minus quantities, removal, live budget amount, accurate validation and mobile screen-reader controls. Update cart/order summary from the server quote; do not trust client totals.
4. **Checkout integration:** Preserve authentication, discounts (revalidated for the chosen mode), approved order terms, request-only delivery date, saved address, payment verification, packing review/approval and tracking. Clear/restore a user’s draft *without* leaking stock reservations.
5. **End-to-end QA:** Valid and invalid SKUs, pricing mismatch, zero/low stock, oversell races, duplicate checkout, cancellation/expiry reservation release, saved-draft restore, discounts, unavailable courier, authenticated account privacy, mobile 320/390/430 and desktop 1280, packing and order reconciliation. Test payments/orders with approved sandbox fixtures; no buyer payment in production test.
6. **Ready-made phase only after inventory:** Separate index and PDP for *verified finished bundle SKUs*, accurate product photo, included contents, price, fulfilment and stock.

## 6. Phase 3 status / next action

- **Source audit:** complete.
- **Curated hamper buyer flow:** exists; no claim of newly executed real end-to-end payment.
- **Self-selected hamper:** not production-ready; **blocked by owner product decision + real SKU costing, stock reservation and order-BOM design**.
- **Ready-made hampers:** blocked by real bundle input assets/inventory.
- **Suggested next approved development slice:** do **not** redesign the whole site; first design an opt-in mode split and backend contract, keeping current curated checkout unchanged. Review actual operator inventory/cost data and confirmation before enabling live product selection.

This document is an assessment, not permission to change sale prices, stock, photos, shipping promises, payment handling, terms, or existing customer orders.
