# Celebration Self-Build — Tier Budgets and Maximum Product Count

**Owner confirmed 13 October 2026; box/packaging budget revised 15 October 2026. Scope: Self-Build gift hampers ONLY.**

## Policy

- The listed *hamper selling price* is the calculation base, **not the price of an individual retail SKU**.
- Fixed **₹50 delivery** is added separately at Self-Build checkout (e.g. ₹499 hamper + ₹50 delivery = ₹549 payable). Internal 80%/75% product allowances are based on the original hamper tier price, excluding delivery. Existing jewellery and curated hamper pricing are untouched.
- Hampers priced **below ₹1,299**: gift selections target and hard ceiling are **80% of the base tier price**; the remaining **at least 20% is reserved for the box and packaging**. The previous 85% gift overrun is removed to keep this reserve intact.
- Hampers **₹1,299 and above**: gift selections target **75%**, with a maximum of **80%** (up to 5 percentage points more). At least **20% remains reserved for the box and packaging**, with the remaining 5% available as buffer when gifts stay at target.
- Being under target is always acceptable: the buyer chooses their own gifts. This is NOT a promised minimum value or minimum number of products. Budget is internal and NEVER included in customer props, JSON, HTML, checkout item lines, source SKU mapping or analytics.
- Limits are calculated **from the current published catalog tier price** each time the server creates a draft/order. Migration 106 initially syncs the targets into admin tier allowance records and auto-refreshes those records when the published catalog is updated.
- **No inventory / capacity / retail SKU mapping / stock reservations.** Admin budget consumption uses owner-approved category-level unit budget values only. No automatic replenishment or inventory checks.


## Box eligibility and packaging budget — 15 October 2026

- **Kappa Box** may be selected only with a **published hamper tier priced at least ₹1,000, before the separate ₹50 delivery fee**. A ₹999 tier does **not** qualify merely because the delivered price is ₹1,049. With the seed tier ladder, **₹1,299 is the first qualifying tier**. Actual published tiers may differ.
- Corrugated Box, Translucent Bag and Printed Bag keep their existing preview selection. This pricing decision does not imply physical box stock or packaging-size availability.
- **20% of the tier price is protected for box and packaging** in the private tier budget policy; it is **not a new buyer-facing surcharge** or an additional checkout charge. The existing ₹50 hamper delivery fee remains unchanged.
- **Phase 3 server preparation:** the unmerged migration `107_self_build_packaging_cost_approval.sql` adds a nullable `box_id` to account drafts and frozen order snapshots plus `self_build_packaging_costs` (four known IDs). All four owner-approved cost fields are initially **NULL/unapproved**: no actual procurement price is guessed. The transaction checks Kappa's ≥₹1,000 pre-delivery tier, exact approved total packing cost and the private 20% ceiling **before inserting a new order**. Retry identity also includes the frozen box ID and packaging amount.
- **Important release gate:** the three-step `/self-build-design` page remains a non-paying design preview. Box choices are NOT YET submitted by the real `CustomerSelfBuildStudio` UI, so a NULL choice fails closed at checkout. Before turning on buyer checkout, collect owner-approved total costs (box, filler, ribbon, inserts) for all four choices, build the authenticated real box picker and confirm actual merchant sandbox/refund flow. Never rely on preview-only controls.

## Item counter — existing catalog maxChoices

Maximum total selections are the existing published `tier.maxChoices` values. **All quantities count as items**, including multiple quantities of the very same category or option. Example: a tier with maxChoices=5 allows a chosen necklace category ×5 but not ×6; mixing two pieces from one category plus three from another also totals 5. A chosen mix can still be rejected if its private aggregate expense exceeds the allowance ceiling; the number is an *up-to maximum*, not a guarantee that all combinations fit the budget.

Customer studio and admin preview both display a small `selected / maximum pieces` card next to category selection controls. The **customer tier cards** show only the tier name, price and `A hamper made to match your budget.`, with no maximum-piece figure on the cards. The buyer never sees private unit costs.

## Current published tier policy

**This table contains PRIVATE internal business allowances, do not show the target or ceiling to customers.** Customer tier cards display the tier name, price and the budget-matched hamper message. The maximum selected pieces is displayed separately during category selection.

| Tier | Price | Maximum pieces | Private target | Strict 80% gift ceiling |
|---|---:|---:|---:|---:|
| Little Joy | ₹299 | 2 | ₹239.20 (80%) | ₹239.20 (80%) |
| Sweet Smile | ₹399 | 3 | ₹319.20 (80%) | ₹319.20 (80%) |
| Celebration Mini | ₹499 | 3 | ₹399.20 (80%) | ₹399.20 (80%) |
| Classic | ₹699 | 4 | ₹559.20 (80%) | ₹559.20 (80%) |
| Premium Classic | ₹799 | 4 | ₹639.20 (80%) | ₹639.20 (80%) |
| Special | ₹999 | 5 | ₹799.20 (80%) | ₹799.20 (80%) |
| Grand | ₹1299 | 6 | ₹974.25 (75%) | ₹1,039.20 (80%) |
| Grand Plus | ₹1499 | 7 | ₹1,124.25 (75%) | ₹1,199.20 (80%) |
| Royal | ₹1999 | 8 | ₹1,499.25 (75%) | ₹1,599.20 (80%) |
| Royal Plus | ₹2499 | 9 | ₹1,874.25 (75%) | ₹1,999.20 (80%) |
| Luxury | ₹3499 | 11 | ₹2,624.25 (75%) | ₹2,799.20 (80%) |
| Signature | ₹5000 | 14 | ₹3,750.00 (75%) | ₹4,000.00 (80%) |

## Validation and safety

1. Draft API enforces total piece max from current tier even if the client posts forged quantity; create-order transaction checks again under the frozen live catalog and rejects overspending without side effects.
2. Private budget ceiling is frozen with the eventual order snapshot; a network retry with changed choices or a changed budget cannot mutate an existing purchase.
3. The admin tier allowances are a mirror of the target percentages, not stock. Do not manually overwrite them; they will update upon catalog publishes. The checkout always computes its actual ceiling independently from the current tier price.
4. Preflight migration 106 must be rehearsed on an isolated restore of the VPS database, with a fresh backup, before production merge. Existing orders, payments, retail inventory, checkout pricing, category images and private photos must remain unmodified.
5. Customer Self-Build checkout remains gated OFF until separately verified merchant gateway sandbox success/failure/refund, owner approval, and delivered+48h R2 deletion operations sign-off.

