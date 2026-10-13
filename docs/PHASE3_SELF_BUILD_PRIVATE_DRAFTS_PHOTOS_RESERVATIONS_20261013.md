# Celebration Phase 3.5/3.6 — Private Drafts, Photos & Stock Reservations

Updated 13 October 2026. **Staged implementation; no customer purchase enabled.**

## Owner-confirmed foundation

Celebration customers choose **category/option and quantity**, never individual SKU/product listings. Eight jewellery categories and separate Bangles, chocolate sizes, snack and perfume sizes remain DB-driven. Photo selection is per photo. Internal unit budget must never be sent to customers. Category-level available units are not retail jewellery SKU stock.

## Migration 051

- Enforces one saved `self_build_drafts` row per verified account, with an existing 14-day expiry and JSON chosen-category/option selection.
- Stores personal photo metadata in `self_build_draft_photos` (private R2 object keys never in responses, account-scoped FK and draft FK).
- Adds `self_build_order_reservation_batches` and `self_build_order_reservation_items` keyed by actual order ID, containing only kind/choice ID/quantity (no SKU).
- Batch statuses: `reserved`, `committed`, `released`. Budget values and customer notes reside in private frozen `self_build_order_snapshots`.
- Safe initial state: **zero draft photos and zero order reservations**. Migration does not remove the `customer_enabled=false` database check, does not introduce a new payment method, and does not modify existing orders.

## Authenticated customer draft API — staged OFF

`GET/PUT/DELETE /api/account/self-build/draft`: owned by a validated customer session. Mutation requires same origin and rate limiting. PUT requires a real active catalog tier and verified category/option IDs, accepted quantity bounds, no duplicate selections, and an optional up-to-1200-character message. Draft is not a quote and never reserves stock or promises availability. For now GET/PUT are deliberately refused with `SELF_BUILD_NOT_LIVE` until a future reviewed launch removes DB hard locks. DELETE is permitted for customers to erase their old account data regardless of the launch gate. Existing customer account/authentication and curated order flow unchanged.

## Personal photos — private R2 only

`GET/POST /api/account/self-build/photos` and `GET/DELETE /api/account/self-build/photos/[id]`. Upload requires an active draft and a selected photo category; does not accept an arbitrary file name/object key, cannot exceed the chosen number of photos or 40 total. Requests are limited to 3 MiB and JPEG/PNG/WebP, validated against actual image content, max 16 MP. The image is rotated, resized at most 1080×1080 and re-encoded to **WebP without EXIF/GPS**. Storage prefix is private `self-build/private/<draft-uuid>/<photo-uuid>.webp`. Customers can only read or delete photos bound to their own verified account/draft. Responses send no R2 key or public CDN links. Upload/list are gated OFF until customer Self-Build launches. Account cleanup deletes private objects and metadata; reusing an expired draft clears its old photos. **Note:** abandoned expired drafts not subsequently touched still require a VPS scheduled R2/db garbage collector before general launch; no unscheduled background worker is being claimed.

## Transactional reservation primitives — NOT CONNECTED TO CHECKOUT

`reserveSelfBuildForOrderWithClient(client,...)` must be called using the *same PostgreSQL transaction* that inserts the actual order. It rejects a disabled customer feature, unknown order/owner/tier, invalid choices, unverified or insufficient category/option stock, duplicate selection, excess private budget and stale admin rules; it obtains configured locks on settings, capacity version and inventory before counting/holding units, freezing labels/amount snapshots, and creating an idempotent reservation batch. A request with an existing order and changed selections/note is rejected; released batches cannot be replayed.

`releaseSelfBuildReservationWithClient`: decrements pending units at most once; a repeat is idempotent. `commitSelfBuildReservationWithClient`: *only after order payment status is paid/verified and reservation not expired*, decrements both available and reserved capacity once; repeat is idempotent. A committed hold is not automatically restocked by release. Both require the caller to manage its transaction and relevant payment/cancellation state.

**No public reservation route, no buyer payment activation, no connection to existing curated checkout or real SKU stock.** Any upcoming checkout integration must link order + quote + reserve atomically with payment/provider idempotency, freeze shipment/packing details and handle expiry/cancel/failed payment; staff must verify category availability and internal tier allowances first. Customer UI preview remains private to admin.

## Verification and next tasks

Source audits plus real PostgreSQL16 isolated CI run tests migration 047→051, hard-disabled buyer mode, no fake stock, genuine account draft/photo shape, receipt of exactly ₹520 private contribution for 2 necklaces + 1 bangle + 3 photos + Starter, duplicate-order retry, changed payload rejection, failed-purchase rollback, pending release, paid commit and two simultaneous requests for one unit. No real customer data or production photo uploads are used in CI.

**Remaining:** approved customer-facing UI integration, category-specific photo upload controls, reliable expiry cleanup job for both R2 assets and unpaid reservation holds, packing capacity and delivery verification, payment/order reservation wiring with end-to-end tests, and explicit owner launch approval. Do NOT call this phase a live payment-ready builder.
