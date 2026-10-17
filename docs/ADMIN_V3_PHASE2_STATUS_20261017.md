# Celebration Admin V3 — Phase 2 (Orders & Products Details)

**Date:** 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**Status:** Implemented on DEVELOPMENT BRANCH; NOT deployed or merged to main. Typecheck, runtime and staging browser QA NOT performed.

## Purpose

Move from Phase-1 searchable read-only list pages to real-record product and order **detail** views while preserving all existing payment, inventory, shipment, catalog-publish, Telegram and customer account operations.

## Changes

1. Added `features/admin/v3/AdminDetailsV3.tsx`.
   - Product details display current live SKU's photographs as a gallery, product description/highlights, category, retail sale eligibility, price, current available stock and recorded retail declarations.
   - Order details display actual stored order-level line items, paid amount snapshot (distinct from payment status), customer/delivery address, packing-video presence, separate courier booking/tracking, issue information and self-build selections when returned.
   - Both detail screens are explicitly read-only; current admin remains the destination for verified operational mutations.
2. Enhanced `features/admin/v3/AdminDashboardV3.tsx`.
   - Search result rows are keyboard-selectable (Enter/Space), not invalid nested buttons.
   - Selecting a product/order shows the detail view; Back returns to the filtered list.
   - From the overview, a recent order opens its recorded details. No status/price/stock changes.
3. Added `styles/admin-v3-details.css` and imported only in the `/admin/v3` preview route; desktop two-column and narrow mobile one-column layouts.
4. Added `scripts/test-admin-v3-phase2.mjs` (TypeScript AST parse + regression guard assertions).

## Current guarantees

- This phase is **read-only** and does not call write APIs or modify product catalog / order status.
- Main `/admin` is unchanged.
- Same passkey-verified server gate; noindex route; admin orders API is already protected.
- Historical product names/quantities/prices come from `order.lineItems` and existing stored order fields, not the current retail product price.
- Shipping booking is NOT treated as confirmed shipment; cancellations do NOT trigger or assert any Cashfree refund.
- Self-Build buyer checkout remains disabled; internal budget information is not surfaced to customers.
- No database migration, images migration, courier/Telegram modifications or public SEO changes.

## Tests and rollout gate

**Performed:** Connector-based source inspection of existing types and admin APIs; file-presence/static contract review; branch diff inspection before phase completion.  
**Not performed:** Full Node/TypeScript `npm run typecheck`, `npm run audit`, `npm run build`, integration/UI browser passkey test, upload/shipping regressions, live tests or production checks. Do not present this as production-ready.

To validate locally or on an isolated staging checkout:

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
npm run typecheck
npm run audit
npm run build
```

Browser review targets: logged-out and expired session access to `/admin/v3`; mobile 320/390, tablet 768, desktop 1440; read-only display; list filtering and selected row keyboard activation; exactly matching customer, stock, item/order snapshots, promo totals and courier fields; broken image fallback, no customer PII in unauthenticated HTML; existing `/admin` operations unaffected.

## Next slice

After tests, add carefully validated product editor and order actions USING existing guarded APIs, not a parallel business engine, with an explicit review of catalog-wide draft/publish impact and payment/shipping state transitions. Bulk inventory and customer-identifiable abandonment data are separate high-risk projects, not implicitly approved by this phase.

## Operations follow-up

- **Changes:** Additive protected V3 product/order read-only detail UI, responsive CSS, parser/static regression checks.
- **Live verification:** None. Live production source and DB not touched.
- **Deployment:** NOT approved; no main merge.
- **Search Console/Bing/Merchant Center/GA4:** No follow-up necessary for this isolated admin code (no customer-facing SEO/product mutation).
- **Recheck:** After typecheck/build and staging screenshots, before any PR is considered for merge.
