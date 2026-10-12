# Celebration — Self-Build Admin Operations & Safety

**13 October 2026.** This is the operational guide for the new native Self-Build section within the existing authenticated Celebration admin. Existing curated hampers and individual retail jewellery are unaffected.

## Where the settings live

Open `/admin`, sign in (including any required passkey), then navigate **Catalog → Self-Build Categories**. The **Overview → Self-Build categories** quick action opens the same workspace. The **View minimalist preview** link opens `/admin/self-build-preview`; that page is admin-only and does **not** accept orders.

This workspace edits existing PostgreSQL-backed settings via `GET/PATCH /api/admin/self-build`, protected by admin session checks, same-origin enforcement, rate limits, version conflicts, validated inputs and transaction-level atomic save. Changes are NOT hardcoded in React; UI only displays and saves returned category/option records.

## Features implemented

- **Category hierarchy**: names, parent folder, display order (up/down), active toggle, nested subcategories; add new categories of kinds *group*, *category with quantity*, *size/variant selector*, or *personalised photos*. Newly added categories start **inactive** and unconfirmed until owner fills in their internal budgets/availability.
- **Delete / hide**: deactivate a saved category safely to keep history; Remove is explicitly confirmed and removes the category's nested children and options once Published. Old staging order/draft paths are currently unwired. Avoid deleting active category definitions after customer ordering launches without a new referential-integrity review.
- **Variant packs**: add, edit, reorder, activate/deactivate and remove pack sizes under Chocolate, Snack, Perfume or any future variant category. Each has its own editable private budget.
- **Internal budget control**: category per-unit cost, variant selected pack consumption, photo per-photo rule (with a selector to change the rule only if the owner deliberately decides), fallback default cost. The customer sees none of these figures.
- **Operational capacity**: `availability_confirmed` and `available_units` on both categories and individual size options, introduced in migration **050**. Defaults are **NOT CONFIRMED / NULL** across the board: absolutely no fabricated available stock. An owner may verify units and mark capacity confirmed. Unchecking confirmation sets the number to NULL; negative, fractional and >1,000,000 values cannot be saved. These are planning figures, **not actual reserved inventory**, and are not used to accept paid Self-Build orders yet.
- **Other requests**: configurable Anything Else? prompt, shown to customer during later fulfilment flow; extra requests are discussed, not automatically charged.
- **Multiple quantities setting**: admin editable, owner-approved default true. Actual buyer stock/budget controls require future checkout implementation.
- **Controlled publish**: unsaved-change status, manual Publish action, Reload with discard confirmation, optimistic version checks (HTTP 409 if another admin saved meanwhile), private error feedback and real DB data reload after save.
- **Always locked**: buyer checkout is disabled and individual item prices cannot be shown, enforced by database CHECK constraints. This page has no customer-launch control.

## Initial owner-approved values in DB

Jewellery categories: Premium Feature Necklaces ₹60, Premium Necklaces ₹60, Necklace & Stud Sets ₹60, Korean Earrings ₹60, Indian Trending Earrings ₹60, Minimal Rings ₹60, Viral Bangles ₹150, Korean Bangles ₹150; standalone Bangles ₹150. These are **private internal category-unit budget values**, not jewellery retail prices.

Chocolate Starter ₹100, Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000. Snacks and Perfume have Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000. Photo budget: ₹50 **per photo**, quantity may exceed one.

All initial category **availability entries are unconfirmed**. Setting a budget alone does not prove physical fulfilment capability.

## No SKU mapping — permanent decision for this phase

A Self-Build buyer selects only a category and a quantity, never a retail item or a named product. Celebration chooses the exact contents within that category. The old SKU mapping schema and source retail-category mapping were removed by migration 049. Admin UI has no import, image, SKU, per-design stock, retail catalogue or product-mapping controls. Category-level capacities must be entered by the owner or fulfilment team, not inferred from retail product quantity.

## Operating rules for safe editing

1. Edit one or more category/pack rows. For an unavailable or unverified category, uncheck capacity confirmation and/or deactivate the choice.
2. Newly created category/size records begin disabled with zero internal budget; explicitly set a cost and confirm any actual availability, then toggle active if desired. Preview activation is **not customer activation**.
3. Click **Publish changes** to write the entire state atomically and advance its version. Until saved, the read-only preview remains on old values.
4. To restore server values without saving, **Reload** and confirm discard. If stale (409), review/copy your edits then reload before reapplying; a stale save never overwrites someone else's change.
5. Open **View minimalist preview** to check spelling, hierarchy, size labels and display order. It remains purely a visual proof: counts, categories and notes in preview are not persisted.
6. Do not use these capacity counters as live stock reservation. Before accepting money for Self Build, implement atomic category/option-unit reservation, backend budget calculation, immutable accepted order composition, cancellation release, packing caps, payment integration and customer-safe rendering.

## Implementation / QA reference

- Migration: `db/migrations/050_self_build_category_option_capacity.sql`
- Server/admin validation: `lib/server/self-build-admin.ts`
- Admin authenticated endpoint: `app/api/admin/self-build/route.ts`
- Editor: `features/admin/AdminSelfBuildManager.tsx`
- Admin navigation: `features/admin/AdminDashboard.tsx`
- Styling: `styles/admin-self-build-20261013.css`
- Real browser/integration QA: `scripts/browser-phase3-self-build-admin-20261013.mjs` on an **isolated localhost Postgres database** and Playwright Chromium
- Isolated migration checks: `.github/workflows/phase3-self-build-db-qa.yml`
- Browser QA: `.github/workflows/phase3-self-build-preview-browser-qa.yml`
- Top-level progress & pending phases: `docs/CELEBRATION_COMPLETE_PROGRESS_AND_NEXT_STEPS_20261013.md`

**Not completed in this admin milestone:** actual customer Self-Build quote/payment/ordering, live reserved/decremented category stock, photo file upload, back-office Self-Build order packing queue, customer-facing category chooser activation. These are separately staged workstreams and must not be claimed live.
