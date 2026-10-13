# Celebration Self-Build — Category Capacity & Budget Rules

13 October 2026. Stage 3.3/3.4. No customer checkout yet.

## Final owner rules

Self-Build chooses **category + quantity**, never a retail SKU or exact product design. Existing Jewellery's eight subcategories remain editable; standalone Bangles is independent. Chocolates/Snacks/Perfume have size options. Photos consume the private budget at ₹50 **per photo**. Internal budget contributions must never be visible to customers. No fictitious available items or products can be seeded.

## Inventory architecture

Migration 050 creates category and option capacity tables with real PostgreSQL foreign keys; quantities default to ZERO and staff-verified status defaults to FALSE. Capacity tracks category-level fulfilment and option-level fulfilment rather than store catalogue SKU inventory. It includes reserved units as a future reservation slot; no existing checkout currently writes reservations.

Admin changes happen via **Self-Build Studio → Availability & budgets**, backed by private authenticated GET/PATCH /api/admin/self-build/capacity. It is CSRF-protected, same-origin, rate-limited, atomically versioned, with a stale-editor error. Admin supplies units that staff can fulfill, and explicitly marks them verified. Zero, unverified, disabled or insufficient free units block the private validator. A category or option deletion cascades to its capacity; routine name, budget and sorting edits are now ID-preserving UPSERTs, rather than deleting all rows.

## Private tier budget allowances

The separate self_build_tier_allowances table starts EMPTY; nothing is enabled by default. Admin must set each tier's **internal consumption allowance** separately from its *public selling price*. Values are verified against live catalog tier IDs on the server. Never infer the internal budget from the storefront's advertised selling price. Setting a budget does NOT activate customer buying.

## Private server evaluator

lib/server/self-build-quote.ts evaluates category/option quantities against current rule version, active parent/category, staff verification, free units, quantity settings and trusted configured tier allowance. It rejects malformed or duplicate inputs, zero/fractional quantities, over-budget orders and arithmetic overflow. For photo category per-unit pricing, internal amount = photo count × configured DB contribution. For sized options, internal amount = quantity × stored option contribution.

The quote result contains INTERNAL values. It is *not safe to serialize to any customer client*. No public budget/stock route was added; no payment, buyer checkout, quote endpoint, inventory reservation, order snapshot or retail SKU mapping added. Existing curated hampers and jewellery shopping remain independent and unchanged. Before launch, the real order path must validate and reserve capacity in one transaction, freeze the accepted selections and rule version, and implement cancellation/expiry releases and realistic packing/fulfilment checks. Database customer_enabled and show_item_prices remain false.

## Verification

PR audit: source safety tests, real evaluator arithmetic and malformed quantity tests; PostgreSQL 16 test for default-zero values, verified inventory, FK cleanup, negative quantities/overreservation rejection and tier allowance constraints. All require successful CI before deploy.

## Next phase

Customer draft/photo storage and transactional category-capacity reservation; only then safely integrate into existing payment/fulfilment and allow customer self-build activation through a separate reviewed migration.
