# Celebration Admin V3 — Analytics & Customer Behaviour

**Milestone:** Analytics V3, 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**Release:** SOURCE IMPLEMENTED, NOT DEPLOYED. Full Node/TypeScript/DB/browser verification pending.

## Implemented

### Authenticated analytics endpoint

- `GET /api/admin/analytics/v3?days=7|30|90`
- Existing admin passkey/session authorization via `isAdminRequest()`; read-rate-limit; `Cache-Control: private, no-store`. This is an aggregate-only GET endpoint; no account contact data, session hashes, phones, emails, carts, addresses or payment tokens returned.
- `getAdminBehaviourAnalytics()` reuses existing `getConversionAnalytics()` for tracked funnel and paid/verified noncancelled orders, order-value, discounts, custom requests, quotes, redemptions and campaign performance.
- Checkout inactivity **event indicator**: group `conversion_events` by hashed browser session within reporting window and count sessions with checkout-reached whose latest observed event is at least 60 minutes old, alongside a subset with **no payment-start event recorded after checkout** in that window. Report sends only aggregate counts; no session hashes or customer linkage.
- Registered-account wishlist **current snapshot**: total current account/SKU relations; distinct registered accounts with a saved SKU; current entries originally saved during the selected reporting period; top 12 SKUs by current unique account saves. Guest device favourites are not observable.
- Individual-product sales: purchased `orders.line_items` JSONB snapshots, paid/verified and noncancelled only, aggregated by product ID, units, distinct order count, and **gross line value before discounts**, limited to 500 highest-unit SKUs. Hamper contents have no accurate individual-item attribution from this data.
- Daily paid-order count / recorded order-value trend in **Asia/Kolkata** dates; no refund-net value.
- No database migration, new browser tracking or customer identity reconciliation.

### V3 screen

- `features/admin/v3/AdminAnalyticsV3.tsx` + `styles/admin-v3-analytics.css`, mounted on original protected `/admin/v3` Analytics nav.
- 7/30/90 day reporting, refresh, error/loading states, verified recorded-order KPIs, anonymous funnel observations, checkout inactivity indicator, paid value daily trend, account wishlist overview and top SKUs, paid individual-product rankings.
- **Current-category attribution** groups the up-to-500 product sale aggregates by today's published product categories; deleted/unlisted SKUs are labelled separately. NOT historical category accounting, full-category financial reporting or campaign profit.
- No customer profiles or account contact details in the analytics response.
- Missing features are explicitly marked **NOT AVAILABLE**, not inferred from user activity.

## What the numbers do and do NOT mean

| Label | Meaning | Cannot infer |
| --- | --- | --- |
| Paid order value | Sum of recorded amounts of paid/verified, noncancelled orders in window | Cashfree settlements, net refunds, profit |
| Funnel sessions | Distinct session hashes independently observed at each event type | Same person across devices, ordered cohort completion, marketing attribution |
| Inactive checkout sessions | Recorded checkout-reached event, no further recorded event for 60m | Truly abandoned, definitely unpaid, identifiable buyer |
| No later payment-start observed | Subset of inactive checkout sessions without a later `payment_started` event in window | Confirmed checkout abandon; missing tracking/cross-device excluded |
| Current saved items | Current registered `customer_wishlist` account×product rows, across all time | Guest wishlists, removed favourites, historical saves |
| Current saves created in period | Still-present rows first inserted in selected window | All additions/removals over time |
| Product quantities/line value | Historical individual-order JSONB purchased SKU lines; gross before cart discounts | Curated hamper contents, true product profit, refunded net |
| Category grouping | Current product-to-category mapping over up to 500 top-selling SKUs | Historical category at sale; fully reconciled category turnover |

**Abandoned cart measurement:** unavailable. Guest cart and checkout drafts are currently client-localStorage (7-day checkout draft) and are not centrally persisted. Calling these 'abandoned carts' or sending recovery SMS/WhatsApp would be inaccurate. A consent-backed server-side recovery workflow requires a separately approved privacy, identity and retention design, and is *not* added here. The previous proposal for 60-minute inactivity/7-day attribution is not treated as operationally proven recovery tracking.

## Safeguards

- No new `conversion_events` instrumentation/identifiers or cookies.
- Never correlate `session_hash` to `customer_account_id` for this report even if source rows contain both.
- No customer targeting or marketing automation.
- No writes to orders, inventory, campaigns, self-build, customer wishlist, analytics events or Telegram.
- No changes to existing checkout flow, payments, GA4, Shipway or product photos.
- Previous 7/30/90 day analytics uses **rolling intervals**; daily labels use IST. The latest/current days may be partial.

## Verification status and required staging tests

**Performed:** Repository source/schema review; GitHub file creation on isolated development branch; source-contract inspection of passkey/auth, aggregate-only data, current wishlist ownership and JSONB order-line types; dedicated script committed at `scripts/test-admin-v3-analytics.mjs`.

**NOT performed:** Local `npm ci`, `npm run typecheck`, `npm run audit`, `npm run build`, execution of static script, real PostgreSQL query, authenticated browser/UI test or stress/performance testing. Do NOT claim deployment readiness.

Suggested staging checks on a checkout with **nonproduction database**:

```bash
npm ci
node scripts/test-admin-v3-analytics.mjs
npm run typecheck
npm run audit
npm run build
```

Essential integration checks:
1. Anonymous/expired admin sessions get 401 and cannot receive aggregate report, account IDs or session hashes. GET responses use private no-store.
2. Supported days 7, 30 and 90 work; invalid period 422. All DB reads are bounded, rate limited and use parameters. Validate query plans on realistic staging dataset.
3. Paid verified jewellery with two line items: product units and gross line values match immutable order snapshots; order-level discounts do not silently allocate to SKU lines.
4. Cancelled or unpaid orders are excluded from paid product totals/daily paid value.
5. A curated hamper contributes to paid-order value but NOT jewellery SKU units.
6. Wishlist counts reflect registered account rows only, not local guest cart/favourites. Removed saved item does not contribute; current new saves within period are reported without inventing removal history.
7. A checkout session with payment_started **after** checkout not flagged as missing payment; a checkout with no later event after 60m only increments proxy count. Don't treat that as a recoverable customer.
8. Category mapping uses published *current* category; removed SKU maps to unlisted bucket; maintain explicit limitation.
9. Empty dataset and DB errors show empty/safe error states, never invented revenue/abandoned customers; browser 320/390/768/1440 visual/keyboard tests.
10. Verify no public/legacy `/admin` analytics change, no customer data leak in Next SSR cache, no Cart/Checkout/Cashfree regression.

## Release and operations follow-up

- **Changed:** New V3 authenticated read-only analytics server function, endpoint, screen, scoped stylesheet, static regression script and this documentation — development branch only.
- **Live verification:** Not performed; production system untouched.
- **Deployment required now:** NO; do not merge to `main` or deploy to VPS until full staging checks and owner's separate release approval.
- **SEO/GSC/Bing/Merchant/GA4:** No public follow-up for these unshipped admin-only changes.
- **Recheck:** Run tests on isolated checkout with staging DB, then review privacy/performance and release gate before main merge.
- **Remaining V3 sections:** Reviews moderation and Settings & Security; full cross-screen QA still required. Also correct the original design documentation that omitted Reviews when separately authorized.
