# Celebration Admin V3 — Customers Management (Initial Read-Only Implementation)

**Date:** 17 October 2026, IST  
**Branch:** `feat/admin-v3-phase1-20261017`  
**Release:** Development source only. NOT merged to `main`, NOT deployed to VPS, NOT tested against production records.

## Delivered

### New admin-only data layer

- `lib/server/admin-customers.ts`: paginated (25/page, max page 100) account directory; optional search by account display name or an **exact 10-digit registered phone**; active/disabled filters.
- Order metrics for each account come ONLY from `orders.customer_account_id = customer_accounts.id`. Count linked orders, paid/verified noncancelled orders, recorded paid-order value **before refunds**, orders with an issue and most recent linked order.
- Account wishlist counts/entries come ONLY from `customer_wishlist.account_id` and the customer's account UUID.
- Account status/phone verification, registration/last login and default-address existence come from `customer_accounts`.
- Directory/detail responses expose a **masked account phone only**. No password hashes, session versions, payment tokens, full guest purchaser contact data or customer-message text.
- Saved default address is **not selected/serialized by default**. An explicit read-only `?address=1` request from the profile's Reveal action returns only that account's saved default address.
- Detail endpoint returns latest 50 linked order summaries and up to 120 saved product IDs; order details remain accessible through the existing safeguarded operational Orders workspace. Saved product names are resolved from current live catalog in UI, labelled as current rather than historical.

### Authenticated, read-only API endpoints

- `GET /api/admin/customers?search=&status=all&page=1`
- `GET /api/admin/customers/[id]` (minimal profile, order summaries, wishlist)
- `GET /api/admin/customers/[id]?address=1` (explicit saved-address reveal)

All require `isAdminRequest()` passkey/session authorization, GET rate limiting, and `Cache-Control: private, no-store`. No new write endpoints; SQL is parametrized. No database migration required, because this uses the existing customer-account, order and wishlist schema.

### Admin V3 interface

- `features/admin/v3/AdminCustomersV3.tsx`: paginated list with name search, exact phone search, status filters, account paid-order/wishlist KPIs and full masked-number display.
- Customer profile tabs: Profile & Address, Orders, Saved Products, Activity. Limited account milestones are shown; **no invented browsing timeline**.
- Sensitive address reveal needs a deliberate click; Hide clears the rendered address. No bulk export or customer impersonation.
- Clicking a linked order routes to the same Admin V3 Orders detail backed by existing guarded operations.
- Loading/error/empty states and abort controllers reduce risk of displaying stale cross-account data when changing selections.
- Scoped responsive `styles/admin-v3-customers.css`, loaded only by the opt-in `/admin/v3` route.
- Source-contract checks: `scripts/test-admin-v3-customers.mjs`.

## Boundaries and privacy restrictions

1. **No guest phone-based account merging.** Guest orders, gift receiver addresses and unauthenticated browsers must never be silently attached to a registered account merely because telephone numbers happen to match.
2. Browser-only guest wishlists, local carts and 7-day checkout drafts cannot be retrieved from this admin UI; there is no server-backed saved cart or identified abandoned checkout record.
3. Paid-order value is sum of noncancelled orders with payment status `paid` or `verified`, **not cashflow, revenue net of refunds, or customer lifetime profit**. Refund/provider reconciliation still lives in the existing payment workflow.
4. Customer default address is current editable saved data; delivery addresses on individual historical orders are separate immutable order snapshots.
5. This feature is initially read-only: account editing, customer notes, support case management, marketing messages, exports and manual account merging **not implemented**.
6. No administrative read-access audit log is present yet; saved-address reveals are protected but **not recorded as permanent audit events**. Before production deploy, decide if persistent sensitive-read auditing and configurable retention are required.
7. SQL aggregate endpoints are page-scoped. Indexes from migration 004 (`orders_customer_account_created_idx`) and 046 (`customer_wishlist_account_recent_idx`) support ownership lookups.
8. No modification to customer login/session, privacy policies, Telegram bot or public storefront.

## Verification status

**Reviewed:** Existing account schema/migrations, account authentication read paths, default address schema, wishlist ownership, order payment status representation and V3 passkey route. Reviewed GitHub file presence and source contracts after commit.

**NOT performed:** `npm ci`, execution of new source test, full `npm run typecheck`, `npm run audit`, `npm run build`, live/staging PostgreSQL queries, authenticated browser/mobile testing or privacy penetration tests. Do not declare production-ready.

Suggested checks using **an isolated staging database**, never live customer data in an unprotected preview:

```bash
npm ci
node scripts/test-admin-v3-customers.mjs
npm run typecheck
npm run audit
npm run build
```

Staging acceptance:
- Logged-out user and expired/non-passkey admin session get 401 and cannot read customer details.
- Account page lists real customers with masked phone; search accepts a name or exactly 10-digit phone; no wildcard/exact phone data leakage.
- An account with zero orders yields zero linked/paid orders; another account with guest orders bearing the same phone must **not** include those guest orders.
- A registered customer's cancelled/unpaid orders appear in linked history but are **excluded** from paid-order count/value.
- Wishlist IDs must be fetched only from that customer's saved-products table; guest browser favourites are not included.
- Address absent by default from the network payload; only requested/returned on explicit Reveal action; switching accounts clears old address; Hide removes it from UI.
- Archived saved SKU remains shown by ID and labelled unavailable, no invented product name.
- Database errors never display zero customers as a successful result; rate limit returns 429, private no-store headers confirmed.
- 320/390/768/1440 mobile/tablet/desktop, keyboard navigation, pagination, loading/error/no-results.
- Operational Orders, checkout, customer login, order notifications, Cashfree/Shipway, inventory and Telegram smoke regressions.

## Operations follow-up

- **What changed:** New development-only admin-only customer read API/service, V3 directory/detail screen, scoped styles, test assertions and this note.
- **Live verification:** None; production application and Postgres untouched.
- **Deployment required now:** NO. Do not merge to main or deploy until end-to-end staging and independent owner approval.
- **SEO/GA4/Merchant Center:** No changes or submissions are required for non-public, unshipped admin code.
- **Next checkpoint:** Staging build/auth/privacy QA, then a separately reviewed aggregate-only Customer Behaviour analytics slice. Guest cart/checkout identity recovery requires explicit consent and a new secure server architecture; do not infer it from existing localStorage.
