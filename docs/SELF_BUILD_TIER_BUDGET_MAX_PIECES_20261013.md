# Celebration Self-Build — Tier Budgets and Maximum Product Count

**Owner confirmed 13 October 2026. Scope: Self-Build gift hampers ONLY.**

## Policy

- The listed *hamper selling price* is the calculation base, **not the price of an individual retail SKU**.
- Hampers priced **below ₹1,299**: aim to spend **80% of sale price** on internal selected gift categories/size options/photos. For an awkward final item, allow at most **85%** (5 percentage points over target).
- Large hampers **₹1,299 and above**: aim for **75%** on chosen gifts; absolute upper tolerance **80%** of sale price.
- Being under target is always acceptable: the buyer chooses their own gifts. This is NOT a promised minimum value or minimum number of products. Budget is internal and NEVER included in customer props, JSON, HTML, checkout item lines, source SKU mapping or analytics.
- Limits are calculated **from the current published catalog tier price** each time the server creates a draft/order. Migration 106 initially syncs the targets into admin tier allowance records and auto-refreshes those records when the published catalog is updated.
- **No inventory / capacity / retail SKU mapping / stock reservations.** Admin budget consumption uses owner-approved category-level unit budget values only. No automatic replenishment or inventory checks.

## Item counter — existing catalog maxChoices

Maximum total selections are the existing published `tier.maxChoices` values. **All quantities count as items**, including multiple quantities of the very same category or option. Example: a tier with maxChoices=5 allows a chosen necklace category ×5 but not ×6; mixing two pieces from one category plus three from another also totals 5. A chosen mix can still be rejected if its private aggregate expense exceeds the allowance ceiling; the number is an *up-to maximum*, not a guarantee that all combinations fit the budget.

Customer studio and admin preview both display a small `selected / maximum pieces` card next to category selection controls. The buyer never sees private unit costs.

## Current published tier policy

**This table contains PRIVATE internal business allowances, do not show the target or ceiling to customers.** Customer UI displays only the tier price and maximum selected pieces.

| Tier | Price | Maximum pieces | Private target | Absolute +5pp ceiling |
|---|---:|---:|---:|---:|
| Little Joy | ₹299 | 2 | ₹239.20 (80%) | ₹254.15 (85%) |
| Sweet Smile | ₹399 | 3 | ₹319.20 (80%) | ₹339.15 (85%) |
| Celebration Mini | ₹499 | 3 | ₹399.20 (80%) | ₹424.15 (85%) |
| Classic | ₹699 | 4 | ₹559.20 (80%) | ₹594.15 (85%) |
| Premium Classic | ₹799 | 4 | ₹639.20 (80%) | ₹679.15 (85%) |
| Special | ₹999 | 5 | ₹799.20 (80%) | ₹849.15 (85%) |
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

