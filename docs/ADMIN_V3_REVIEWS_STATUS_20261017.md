# Celebration Admin V3 — Reviews Moderation Milestone

**Date:** 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**State:** SOURCE IMPLEMENTED ON DEVELOPMENT BRANCH; NOT MERGED OR DEPLOYED. Runtime SQL, Next typecheck/build, actual tests and staging/browser verification still pending.

## Scope delivered

1. **Admin-only queue service:** `lib/server/admin-review-queue.ts`
   - Server-side pagination (25 reviews per page, max page 400), status (All/Pending/Approved/Rejected), rating (1–5/all) and constrained search across SKU, real reviewer name/city and submitted review text.
   - Global counts for submitted, pending, approved and rejected rows plus arithmetic mean rating of approved database rows. These counts do **not** silently depend on the first 100 loaded reviews, unlike the original legacy admin queue.
   - Oldest pending reviews appear first. 25-row pages are not treated as global totals.
   - Includes actual current order reference/status/payment status and `approvalEligibleNow` boolean calculated by the same verified account / paid + delivered retail order / exact purchased SKU conditions used in the existing server moderation procedure.
   - Minimal read-only DTO: does **not** select buyer phone, password, delivery address, payment references, full order lines or internal customer account ID.

2. **New protected admin READ endpoint:** `GET /api/admin/reviews/v3`.
   - Existing admin passkey/session authorization with `isAdminRequest()`.
   - Rate-limited, parameterized queries, `Cache-Control: private, no-store`, and validated pagination/filters/search.
   - No write actions added here. Review submission, public moderation and photo storage APIs stay unchanged.

3. **V3 Reviews UI:** `features/admin/v3/AdminReviewsV3.tsx`.
   - Live global review metrics, search, rating and status filters, pagination, real review inbox.
   - Detail pane displays exact customer-submitted text/rating, optional authorized review photo, SKU, current catalog product name, reviewer name/city, original linked order ID and current delivery/payment eligibility. No synthetic testimonials.
   - **Approve/Reject only for Pending reviews**, via the **existing** authenticated, same-origin, rate-limited `PATCH /api/admin/reviews` endpoint. Owner confirmation is required for both.
   - Approve is disabled when order/account eligibility is not presently verified, and the existing backend revalidates that condition at commit.
   - Reject confirmation warns that genuine negative reviews should not be suppressed simply because they are negative.
   - Success refreshes server state; 409 already-reviewed/stale eligibility and 401 expired-session states show an explicit error.
   - Photo display reuses existing secured `/api/reviews/photo/[id]` route.
   - From a review, open linked order in the existing V3 Orders workspace.
   - Responsive isolated `styles/admin-v3-reviews.css`, loaded only in `/admin/v3`.
   - Existing `/admin` Reviews component stays unchanged.

4. **Source-contract test:** `scripts/test-admin-v3-reviews.mjs`.
   - TSX parser assertions, auth, minimal response, pagination, existing eligible-delivery checks, moderated-only workflow, CSS. Created on branch; NOT YET EXECUTED in project runtime.

## Important moderation boundaries

- **Authentic only:** Submission requires the signed-in account's paid/verified delivered individual order and exact purchased SKU. One submission per customer/SKU.
- **No editing:** Neither stars, text, photos nor reviewer name can be modified by the owner. There is no owner-authored review feature, seeded testimonials or fabricated aggregate counts.
- **Current verified eligibility is dynamic:** Even an approved database review must continue to meet public display conditions (`approvedProductReviews()`). Approved row count/mean may therefore differ from the exact currently visible public rating on a product page. UI explicitly labels this.
- **Status is terminal:** Existing database supports only `pending`, `approved`, `rejected`; existing moderation API transitions `pending` to approved/rejected only. No restoring, hold, flagged queue or reverse moderation operation.
- **Rejection reason not persisted:** Confirmation asks for policy-relevant grounds (spam, personal data, abusive/irrelevant content); no new reason field or immutable moderation audit ledger was added. Additional audit/procedural safeguards require explicit planning before operational rollout if necessary.
- **Customer privacy:** Admin can see customer-submitted public-facing review name/city and linked order reference. No private phone, account credentials, shipping addresses or payment tokens are returned from the new queue endpoint.
- **No public behaviour changes:** Approval still uses the same existing endpoint and published-review visibility rules.

## Review of earlier design record

The original admin design documents and older visual prototype enumerated nine screens and omitted Reviews, despite including Reviews in the sidebar. **The correct Admin V3 scope is TEN main screens**, including Reviews as Screen 09 and Settings & Security as Screen 10. This milestone adds the previously omitted Reviews section. Prior design document not amended automatically; a comprehensive design refresh should fix numbering.

## Required staging test plan (NOT yet executed)

```bash
npm ci
node scripts/test-product-reviews.mjs
node scripts/test-admin-v3-reviews.mjs
npm run typecheck
npm run audit
npm run build
```

Staging with isolated PostgreSQL, test accounts/orders and sample customer-submitted REALISTIC TEST DATA (never seed a fabricated public testimonial on production):

1. Logged-out and expired admin requests receive 401. Public unapproved review/photo requests remain blocked.
2. Global Pending/Approved/Rejected counts, average and 25-row pagination match staging table; queue search/rating filters never surface unrelated rows.
3. Verified delivered, paid, individual order with matching SKU and active verified customer: pending review can be approved; public product review appears through original site API.
4. Unpaid/cancelled/unshipped/non-matching SKU, disabled/unverified account: approval is disabled in V3 and guarded at backend even if the client is bypassed.
5. Race: two admins attempt same review; only first pending->terminal write succeeds, second gets 409, UI refreshes.
6. Rejecting a legitimate negative review must never be recommended solely because of star rating; assess site policy and consumer fairness.
7. Photo remains behind original admin-or-verified-approved gate; customer image EXIF/identity handling stays unchanged.
8. Confirm exact customer text, name, stars, linked order ID are never rewritten on approve/reject. Existing Admin V2 workflow remains compatible.
9. Browser 320/390/768/1440 responsive, focus, keyboard navigation, accessibility and invalid/empty/error handling.
10. No public merchandising/rating changes before an authorized deployment; no Cashfree/Shipway/Telegram, customer, inventory or Vercel modification.

## Release status and next work

- **What changed:** Additive V3 admin read service/endpoint, Reviews UI/styling, source tests and this documentation.
- **Live verification:** NONE. No production database review was moderated.
- **Deploy now:** NO. This code remains on nonproduction development branch; main auto-deploy must not be triggered without new instruction and passing staging QA.
- **SEO/Merchant/GA4:** No public follow-up before deployment. After any eventual authorized real review approval in production, check product review display and aggregate structured data only where appropriate; never invent reviews, star ratings or rich-result claims.
- **When to recheck:** After executing source/build/browser/DB staging tests, then before production merge.
- **Remaining main screen:** Settings & Security V3 (Screen 10), followed by cross-screen integration/security/performance verification and owner approval.
