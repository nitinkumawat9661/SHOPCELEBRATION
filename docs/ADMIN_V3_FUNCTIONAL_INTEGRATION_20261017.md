# Celebration Admin V3 — Functional Integration Milestone (Development Only)

**Date:** 17 October 2026 (IST)  
**Development branch:** `feat/admin-v3-phase1-20261017`  
**Release state:** IMPLEMENTED SOURCE CODE / UNVERIFIED RUNTIME. Not merged to main, not deployed, no production database writes.  
**Scope:** V3 focused product editor + reuse of existing secure order operations. No new underlying checkout/payment/stock/courier/Telegram business engine.

## Changes made

1. `features/admin/v3/AdminDashboardV3.tsx`
   - Replaced duplicate ad-hoc order loading with the established `useAdminOrders` hook.
   - In an order detail, mounts the **existing** `AdminOrderCard` for allowed status transitions, packing video and Shipway/manual shipping; passes the same callbacks used by current `/admin`.
   - Displays hook error/success feedback; uses actual server-reloaded order details following mutation.
   - Provides a focused edit action from selected product; navigational changes and logout warn if unsaved product edits exist.
   - Refreshes real public catalog after a successfully published catalog change. Other V3 tabs remain explicit placeholders; no bogus data.
2. `features/admin/v3/AdminDetailsV3.tsx`
   - Adds an `Edit this product in V3` action and an optional guarded operational area under recorded order snapshots.
   - Old prices and order items are still drawn from immutable order records.
3. `features/admin/AdminCatalogManager.tsx` (**existing source edited on this development branch only**)
   - Adds optional `focusProductId` so V3 renders ONE selected editor while preserving original product indices and the existing full-catalog draft/publish backend.
   - All new props optional: existing `/admin` editor continues with its original all-products view and familiar actions.
   - Disables SKU identity edits, bulk uploads, mass activation, duplication, deletion, reordering and inventory-quantity mutations in the focused V3 mode. Existing full editor maintains those features.
   - Shows an actual live-vs-shared-draft global impact preview: affected product IDs and hamper tiers; ordering, occasions and default settings changes.
   - Blocks publishing if live baseline could not be loaded. Shows explicit GLOBAL CATALOG PUBLISH confirmation before calling existing guarded PUT or draft-publish POST.
   - Rechecks the shared draft timestamp and published version before a focused Save Draft/Save Live to detect another-tab edit; existing backend version validation is retained. This is a best-effort UI stale-draft check, **not an atomic compare-and-swap on the draft timestamp**; concurrent writers still need stronger server control before production.
   - Disables wholesale shared-draft discard while focused, to prevent wiping another user's changes.
4. `styles/admin-v3-details.css` provides additive scoped styles to existing product editor and protected order actions.
5. `scripts/test-admin-v3-functional-integration.mjs` adds TSX syntax parsing and static checks for reuse of known backend workflow and guard rails.

## Data safety / constraints

- V3 order mutations are only enabled on authenticated Admin V3 route and call the existing `useAdminOrders` / `AdminOrderCard` logic. Original order status API still checks `isAdminRequest()`, request origin and allowed transitions; original shipping APIs call existing Shipway service and verified transitions.
- **Cancelling an order does not initiate Cashfree refund.** The existing confirmation warning remains, and no new refund API was built.
- **Booked AWB is not automatically shipped.** Shipping and courier pickup rules are not redefined.
- Catalog writes remain in version-guarded `/api/admin/catalog` and `/api/admin/catalog/publish`. Since they publish entire catalog, focused editor shows global impact and asks for an explicit confirmation.
- **Retail stock input/Save stock are disabled in focused V3 mode**; the separate inventory workflow remains unchanged.
- The established Self-Build customer checkout disabled DB gates remain untouched, and private internal budgets are not surfaced to customers.
- Telegram/customer order messaging, homepage, page-speed, retail photos, GA4 and public SEO have not been modified.

## Testing status

**Source-level verified:** GitHub diff inspection of development branch; existing service contracts/read-only route security and new UI wiring inspected; static source spot checks.  
**Must run before merge:** full TypeScript compile, npm audit/test suite, Next build, keyboard/mobile browsers, staged API integration against a NON-PRODUCTION DB, blank/error states, owner visual acceptance. Static regression scripts have been *added*, not executed in this tool environment. No claims of successful checkout tests, database mutation tests or staging/browser checks.

Suggested commands on a checked-out development branch:

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
node scripts/test-admin-v3-functional-integration.mjs
npm run typecheck
npm run audit
npm run build
```

### Required staging acceptance cases

- Non-admin visitors and expired sessions cannot access `/admin/v3` (no client PII leak).
- Selecting a SKU shows only that SKU's existing image/pricing/declarations. SKU/stock cannot be changed from this focused editor.
- Save Draft preserves the public catalog; Save Live asks for an accurate **full-catalog** impact confirmation, then server version check; support an already-existing unrelated draft.
- Multi-tab conflict: second editor saves to shared draft; first editor must refuse stale Save. Server-side atomic draft concurrency should be hardened before deployment if multi-admin editing is expected.
- Successful publish refreshes V3 live list; stale version errors clearly surface; don't touch permanent source image ownership.
- Order transitions restricted to `adminAllowedTransitions`; cancellation and refund resolution confirmations are preserved; fake Cashfree refund cannot occur.
- Shipway auto-booking and packing-media workflows use the original backend without duplicate booking, inflated shipping status or PII exposure.
- 320/390/768/1440 responsive, gallery fallback, unsaved-edits prompt, keyboard navigation, currency/timezone validation.
- No regression to existing `/admin` editor, public jewelry/cart/checkout, Shipway/Telegram bot; main auto-deployment remains off.

## Operational follow-up

- **What changed:** New development V3 wiring to existing protected product publishing and order operations, plus one backwards-compatible optional-prop change to legacy Catalog Manager.
- **Production verification:** Not performed; production unchanged.
- **Deployment required now:** NO. Do not merge to main.
- **GSC/Bing/Merchant/GA4:** No follow-up for an unshipped internal admin development change.
- **Recheck:** After non-production typecheck, build and staging browser QA; report results before obtaining owner's independent production deployment approval.

## Remaining development

Inventory atomic transactions/history; complete curated/self-build experience; offers wizard; secure customer profiles/wishlist/abandonment metrics; product/category reporting; settings/security. The remaining user-approved *designs* are not yet implementations.
