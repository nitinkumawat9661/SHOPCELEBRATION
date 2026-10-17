# Celebration Admin V3 — Hampers Management Milestone

**Date:** 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**State:** Implemented on isolated development branch, **NOT merged to main / NOT deployed**. Runtime/TypeScript build/browser/staging DB tests remain outstanding.

## Delivered

- `AdminHampersV3`: cohesive desktop/mobile workspace with 5 tabs:
  1. Curated Hampers: live published tiers and existing safeguarded `AdminCatalogManager section="tiers"`
  2. Occasions: existing catalog-managed `section="occasions"`
  3. Self-Build Studio: original `AdminSelfBuildManager` (category groups, size options, rules, nested capacity/budgets)
  4. Custom Requests: existing `AdminCustomRequests` queue, with its protected server endpoints
  5. Payment Reviews: original `AdminSelfBuildPaymentReviews`; documentation only, **no automatic Cashfree refunds**
- Curated tier cards display actual published catalog tier name/base price/size/maxChoices. **Never claim tier base price is the final amount charged at checkout**; checkout-delivery rules remain authoritative.
- The two catalog edit tabs use `reviewGlobalPublish` to display a whole-catalog impact report and explicit confirmation covering unrelated SKU and hamper-tier edits, ordering, occasions and shared defaults. Both use existing admin `Save draft` and `Save live` calls and previously established version checks. The existing legacy `/admin` editor is unchanged in its default mode.
- `AdminSelfBuildManager` and `AdminSelfBuildCapacity` now optionally report unsaved changes, including invalid raw fields. The V3 sidebar, section tab and logout confirm before abandoning changes; `beforeunload` warnings remain for browser refresh/close.
- Adds `styles/admin-v3-hampers.css`, loads existing `styles/admin-self-build-20261013.css` on the opt-in `/admin/v3` route.
- Adds `scripts/test-admin-v3-hampers.mjs` TypeScript syntax and source-contract assertions.

## Backend invariants: must remain exactly as existing

- Self-Build customer checkout remains **OFF** via type-locked `customerEnabled:false` and server validation; public `showItemPrices:false`. Admin settings do not enable buyer checkout.
- Category-first selection; no implicit retail SKU allocation, no automatic decrement of individual-product inventory from Self-Build.
- Private budget targets 80% below ₹1,000, 75% at ₹1,299+, up to +5 percentage points for fitting final selection, as governed by existing backend; changing catalog tier price triggers the existing tier allowance calculation rather than a new duplicate.
- Curated price and shipping total are determined by the current published catalog and checkout policy, not a hard-coded V3 setting.
- Existing category capacity and tier allowance API uses its own optimistic version. Saving it is independent of the shared curated catalog draft. No fake shared commit between these systems.
- Custom requests retain existing customer data, statuses and WhatsApp/manual follow-ups only.
- Payment reviews only document external references after manual provider checks and do **not** initiate money movement.
- Telegram, payment, order status, shipping, private media retention and jewelry image storage remain unchanged.

## Security considerations

- UI imported exclusively by the server passkey-gated `/admin/v3` route; existing same-origin admin PATCHs, rate limits and version guards remain.
- Self-Build private budgets and customer custom request contact details are admin-only. No public new endpoints.
- Shared catalog save/publish has a review prompt, but existing backend still uses catalog-wide versioning, not an atomic *draft timestamp* compare-and-swap. Two concurrent draft writers can still race. Resolve server-side before production merge if multi-session edits are expected.
- The existing capacity and Self-Build configuration each have independent version counters; V3 does not attempt atomic save across them.
- The current legacy editor and its stock-save workflow are not replaced in this milestone.
- Do not assume a saved Self-Build setting has caused a charge or fulfilment reservation.

## Verification performed / outstanding

Performed:
- Read-only inspection of GitHub's original admin component/API contracts.
- Source-level checks of passkey gate, V3 integration and preserved `customerEnabled:false` / `showItemPrices:false` / SKU-no-mapping contract.
- Confirmed all source changes remain in the development branch.

Not performed:
- No `npm run typecheck`, `npm run audit`, `npm run build`, `npm run db:migrate`, authenticated browser QA or real PostgreSQL write tests. Do not call this production ready.
- New test script was committed, **not executed** in the current connector-only GitHub environment.

Suggested checks on a **non-production isolated checkout**:

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
node scripts/test-admin-v3-functional-integration.mjs
node scripts/test-admin-v3-inventory.mjs
node scripts/test-admin-v3-hampers.mjs
npm run typecheck
npm run audit
npm run build
```

Acceptance cases:
1. Passkey-less user cannot load sensitive V3.
2. Tier/occasion draft save updates only draft; Save Live requires clear global impact review; changed drafts conflict safely.
3. Switching sidebar/tab/logout with unsaved Self-Build category, **invalid amount** or nested capacity edits prompts before discard.
4. Self-Build config still returns `customerEnabled:false`, `showItemPrices:false` after a staging edit.
5. Private category amounts never appear in a public customer endpoint. Self-Build buyer checkout still hard fails.
6. Category capacity updates do not reduce retail SKU stock, and cannot undercut existing reserved category quantities.
7. Payment review external reference stores documentation only, provider payment/refund untouched.
8. Custom request status changes work only in authorized staging.
9. 320/390/768/1440px responsive; no overlapping legacy forms/button footers; old `/admin` untouched.
10. Existing Cashfree/Shipway/Telegram and public hamper checkout smoke tests remain green.

## Release status

**Live VPS store:** untouched.  
**Live Postgres:** untouched.  
**Vercel:** the previous `celebration-home-50-50-preview` project is no longer listed under the linked Vercel team as of this milestone's check; no Vercel deployment was initiated for these commits.  
**Next safe development:** Offers V3 using current `AdminCampaigns` and protected campaign APIs, followed by customer/analytics after data/privacy review.  
**Merge/deployment:** require test evidence and new explicit approval.
