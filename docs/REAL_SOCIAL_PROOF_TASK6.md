# Task 6 — Real orders and genuinely verified reviews

**Date:** 2026-10-10  
**Owner-approved source of truth:** [FINAL_POLISH_AND_AI_FEEL_REMOVAL.md](./FINAL_POLISH_AND_AI_FEEL_REMOVAL.md)  
**Staging:** `feat/final-polish-task2-media-cards-20261010`, PR #91 — **NO MERGE / PRODUCTION DEPLOY UNTIL FINAL RELEASE**

## 1. Evidence / issue audit

The homepage had an existing `getTierPopularity()` metric. It previously counted hamper orders with a paid/verified/success payment and **any non-cancelled status**. That is not the same as successfully delivered; a processing or unfulfilled order could contribute to a public popularity claim. The original threshold of at least 20 total paid orders, at least five on the popular tier and at least 20% share was privacy-conservative; **those thresholds have been retained but the fulfillment requirement is now stricter**.

The reviewed public review system already had useful protections: an authenticated phone-verified account, a matching paid/verified, delivered individual order containing the precise SKU, consent on submission, review inserted as `pending`, manual admin moderation, photos re-rendered to strip metadata, rate limits, and a genuine `Be the first to review this product` empty state. No fake review records were inserted in the original SQL migration.

**Gap found:** Public `approvedProductReviews` and public photo reads were filtered on the review row's `approved` status but did not recheck that the attached order **still genuinely qualifies** (correct account/SKU, paid and delivered, verified account). Moderation of a pending row could also approve without reconfirming the linked order. These are now guarded by the order record itself.

**UI correctness gap:** On a review query outage, the product page silently supplied `[]`, falsely displaying `No reviews have been published yet`. This is now explicitly distinguished from a true zero-review result.

A legacy, currently unused `ProofAndReviews.tsx` component contained a five-star graphic, a repeated review-like marquee, and an unconditional packing-video claim. This component was cleaned: it renders no stars or simulated reviews and gates any optional aggregate strictly against actual qualifying orders.

## 2. Implementation and public behavior

| Surface | Evidence requirement | Public presentation |
| --- | --- | --- |
| Home hamper popularity | **Paid AND delivered** hamper orders only; distinct real order IDs, valid tier; >=20 total, >=5 on displayed tier, >=20% share; active catalog tier and mathematically valid percentage | One small neutral aggregate: `X% of Y paid and delivered hampers used the Z budget`; hide when data missing, cohort too small or tier discontinued |
| Hamper budget `MOST CHOSEN` badge | Exactly the same validated proof as above | Only on matching active tier; never derived from operator claim or random labels |
| Product reviews, public list | Review approved with `reviewed_at`, verified active account; join real individual order of same account, status `delivered`, payment `paid`/`verified`, matching SKU within recorded order line items | Only truly verified and approved rating/text/name/city; no synthetic testimonials |
| Review submission | Signed-in, phone-verified active customer; delivered/paid correct product; form consent; rate limit, same-site POST | New row starts `pending`; no automatic publication |
| Admin moderation | Admin authenticated, same-origin and rate-limited; approve only while qualifying order/account/SKU still valid | `approved`/ `rejected`; invalid approval is not accepted |
| Public review photo | Approved, reviewed and matching verified delivered order; admins can inspect moderation queue | No unauthorized public access to pending/rejected photos |
| Zero approved verified reviews | Successful query, actual 0 | **Be the first to review this product** |
| Review database failure | Query unsuccessful, no count known | **Customer reviews are temporarily unavailable**, no false zero-review claim |

**Privacy:** The home aggregate includes **no customer names, phone numbers, order IDs, timestamps, addresses, or city details**; never publish small cohorts as order insights. Product review name/city/text/photos follow the existing explicit consent flow. This work does not add PII to homepage social proof or tracking.

**No fabricated activity:** There is **no** recently-purchased toast, rotating order ticker, fake stars, or invented ratings. A truthful `no data` case emits **no** sales percentage. Brand/editorial design remains quiet.

## 3. Automated verification

Files and protection changes:
- `lib/server/orders/read.ts` — verified delivered-only query and integer guards.
- `lib/domain/real-social-proof.ts` — deterministic cohort, active tier and percent validator.
- `features/home/Storefront.tsx` — same validated proof for small home note and actual budget badge.
- `lib/server/product-reviews.ts` — order/account/SKU checks during listing, eligibility, moderation and photo access.
- `features/catalog/ProductReviews.tsx` and `app/jewelry/[id]/page.tsx` — distinguish true zero from review data outage.
- `features/home/ProofAndReviews.tsx` — remove unused misleading five-star component.
- `styles/real-social-proof-task6.css` — unobtrusive mobile-ready aggregate note.
- `scripts/test-real-social-proof-task6.mjs` — executes actual evidence validator with valid/invalid cohorts; asserts payment, delivery, moderation, exact-product and permission guards.
- Existing `test-product-reviews.mjs`, `test-final-storefront.mjs`, `test-homepage-human-copy-task5.mjs` adjusted for stricter verified proof. All tests remain wired to `npm run audit`.

**CI checkpoint:** GitHub Actions run **38034996603 SUCCESS**, including `npm run audit` and `npm run typecheck`. These are code-level guarantees; no live database records were queried or altered by this task.

## 4. Live database and user-acceptance QA — pending

Before releasing, test in a staged environment with **synthetic sandbox orders only** and verified restoration/cleanup; do not alter actual production order/payment statuses:

1. No hamper orders, fewer than 20 real eligible orders, <5 leading-tier orders, and <20% share → no proof and no `MOST CHOSEN`.
2. 20 genuinely paid **delivered** hamper orders, >=5 on an **active** tier → one precise cohort percentage; other statuses pending/packing/shipped/cancelled, or unpaid delivered, **must not count**.
3. Legacy inactive tier may have most orders → no public popularity claim or suggestion for unavailable budget.
4. One eligible delivered SKU purchase signed in and consented → one pending review; anonymous/unverified account, unpaid, cancelled, undelivered, wrong SKU, repeat reviewer, no consent or cross-site POST → no public review.
5. An authenticated admin can approve only a still eligible order-linked review; a non-admin cannot moderate; rejected/pending content and photos are inaccessible to public.
6. Truly no published verified reviews → honest `Be the first to review`; one approved review → one matching reviewer rating/text; query outage → temporary-unavailable message (not zero).
7. Review photo strips metadata (EXIF) and is served only after approval; customer phone/address never appears on the product page or homepage.
8. Verify home aggregate and product reviews at **320, 360, 375, 390, 430px** and desktop widths; no overflow, confusing counts, huge fake-stars widgets, or covered commerce CTA.

**Known limitation:** Live production order counts and review counts are **not verified from the codebase**; we make no claim that the storefront currently has any qualifying sales/reviews. Actual browser/manual QA is pending. Source-level tests are not replacements for a database integration test or a real phone run.

## 5. Deployment batching

Keep PR #91 **OPEN, UNMERGED** after automated CI, per owner. Continue Tasks 7–9 using this branch. Only do the final main merge and production deployment once the remaining tasks and required release tests are complete.
