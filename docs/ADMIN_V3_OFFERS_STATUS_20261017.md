# Celebration Admin V3 — Offers & Coupons Milestone

**Prepared:** 17 October 2026, IST  
**Branch:** `feat/admin-v3-phase1-20261017`  
**State:** Development branch source implementation ONLY. Not merged, not migrated/deployed, not tested with real payments or the live store.

## What was added

### Offers V3 studio

`features/admin/v3/AdminOffersV3.tsx`, wired into existing passkey-protected `/admin/v3`, provides:

- Published campaign-state overview: total, enabled within schedule, future scheduled, inactive/expired.
- Date-scoped (7, 30, 90 days) **existing server-derived** reports: quote records, quotes linked to verified/paid noncancelled orders, applied discount total on paid orders, paid order count and actual campaign IDs with paid order/discount numbers.
- Published campaign list with discount display, coupon/automatic mode, scope and IST start/end schedule.
- Empty/error/loading states; no invented figures, no misleading ROI/profit, no fake 'live sales'.
- Operational editor below the overview, reusing `AdminCampaigns` and the existing protected `/api/admin/campaigns` API; no new discount engine and no new checkout pricing endpoints.
- Responsive CSS scoped to `/admin/v3`.

### Existing campaign editor, additive opt-in V3 enhancements

`features/admin/AdminCampaigns.tsx` now accepts optional `v3` (default false), `onDirtyChange`, and `onPublished` props.

- V3 in-editor search across name/ID/coupon/scope/badge and status filters (all, enabled in window, scheduled, off, expired).
- Explicit warning before deleting a campaign in V3; deletion edits local state and does not touch server until Publish.
- Unsaved-change prompts before browser refresh, V3 sidebar section switch, logout or editor Reload.
- Before Publish, explicit **entire campaign configuration** confirmation lists number of campaigns, active flags and coupon-mode campaigns, and warns of immediate checkout effect and existing individual-cart eligible-product behavior.
- Uses the existing `PATCH /api/admin/campaigns` with the backend's expected version, transaction and row lock. A version conflict requires a fresh reload.
- Reload the published overview after success; keep the current Admin V2 full list/status labeling by default.

### Source safety tests

`scripts/test-admin-v3-offers.mjs` checks TSX syntax using TypeScript parser and asserts V3 integration, passkey gate, state/guard handling, API auth/origin/version safety, and metric source. **The test file was committed but not executed from a checked-out project in this session.**

## Pricing and customer safety retained

- Only existing automatic and coupon checkout flows. No offer stacking, no admin bypass for first paid order verification, no resetting per-customer/global usage caps.
- **Important legacy pricing rule:** eligible product IDs for an individual cart form an **any-item matching predicate**. If any item matches, the discount is calculated on the **full qualifying cart subtotal**, not just the matched item price. V3 surfaces this warning rather than pretending per-line discount behavior.
- Existing limit accounting includes open quote reservations and submitted (non-cancelled) orders, so headline **enabled** does not promise all customers will see an offer.
- 'Off' in current campaign config is represented by the active flag; archive/duplicate, true persistent draft and simulator **not added**. Existing campaigns can be removed but deleting historic IDs does not erase paid order snapshots.
- No change to Cashfree refunds/charging, Shipway, Telegram bot, inventory, self-build buyer checkout disabled lock or public product photos.
- Existing campaign writes apply immediately after successful API PATCH; preview 'draft' means unsaved local React state, NOT an independently persisted draft.
- Checkout quote/purchase logic and analytics SQL remain untouched.
- No data migration or Vercel project changes were made in this milestone.

## Test status and release gate

**Completed:** Read current source of `AdminCampaigns`, `lib/server/campaigns.ts`, `app/api/admin/campaigns/route.ts`, analytics endpoint and V3 passkey gate. Verified new GitHub files exist and focused source contract checks are satisfied. Branch still separated from main.

**Not completed:** `npm ci`, full `npm run typecheck`, `npm run audit`, `npm run build`, AST test-script execution, auth browser QA or real DB staging/API integration tests. Do **not** treat this as production-ready.

On isolated staging with **nonproduction** config/database:

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
node scripts/test-admin-v3-functional-integration.mjs
node scripts/test-admin-v3-inventory.mjs
node scripts/test-admin-v3-hampers.mjs
node scripts/test-admin-v3-offers.mjs
npm run typecheck
npm run audit
npm run build
```

Mandatory staging cases:
1. Passkey session is required for V3 and campaign JSON; expired session blocks edits.
2. Compare V2 and V3 offers from identical API response; add/edit with V3; verify only one versioned backend save occurs.
3. Simulate second editor saving before first; stale version returns `CAMPAIGN_VERSION_CONFLICT` without replacing newer config.
4. Verify automatic and coupon mode, code validation, percent/fixed discount caps, minimum subtotal and first-paid-order restrictions using existing backend tests.
5. Verify per-order product predicate (one eligible + one ineligible line -> current discount behavior applied to cart subtotal); confirm prominently labelled warning.
6. Verify boundary time zones (IST in V3 display and local datetime input), scheduled/expired filtering and no fake active-user counts.
7. Verify saved offer usage reservations and released cancellation slots; no hidden side effects in read-only reporting.
8. Verify manual Publish confirmation before immediate change to checkout; unsaved editor navigation/reload/logout prompts.
9. Verify 320/390/768/1440px mobile layout, no overlapping inputs, keyboard focus, empty list and API errors; compare V2 editor regression.
10. Check no Vercel deploy and no production merge; VPS/public checkout unchanged.

## Operations follow-up

- **Changed:** Development-only Offers V3 overview, versioned editor enhancement, scoped CSS, test and this documentation.
- **Live verification:** None. Production business data/checkout never accessed or modified.
- **Deployment required now:** NO. Production merge/deploy must await build + staging evidence and separate owner approval.
- **SEO/GSC/Bing/Merchant/GA4:** No external follow-up for unshipped admin code.
- **Next checkpoint:** TypeScript/static tests in a real checkout, then secure customer-directory/analytics planning without unconsented identification of abandoned guests.
