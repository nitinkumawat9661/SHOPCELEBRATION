# Celebration Self-Build — Order Operations & Checkout Safety

**13 October 2026 • staging milestone — customer purchasing remains OFF**

## What is now implemented

- Existing authenticated **Admin → Orders** cards recognize any future Self-Build order that has a verified `self_build_order_snapshots` record. They show the customer-selected **category or size labels and quantities**, their **Anything Else?** note and the recorded stock reservation status. Packing staff choose the exact physical pieces; **never reference a retail jewellery SKU** for Self-Build.
- The admin-only `listOrders` service loads snapshots for already-fetched order IDs. It **whitelists the labels and quantities**. It does not serialize the internal total budget, tier allowance, customer photo object keys or confidential cost details. Customer My Orders/tracking endpoints remain untouched.
- Both existing manual and gateway checkout endpoints reject explicit `selfBuildDraftId`, `selfBuildSelections`, `selfBuild: true`, and `orderType: "self-build"` requests with `SELF_BUILD_NOT_LIVE` instead of accidentally creating a curated hamper order.
- `scripts/cleanup-self-build-staging.mjs` safely removes expired customer drafts, including their **private Cloudflare R2 photo objects**, with a database advisory lock, row-level locks, one small batch at a time and fail-closed storage errors. It reports expired order stock reservations **without blindly releasing them**: a payment provider may still report an asynchronous successful capture.
- `.github/workflows/self-build-staging-cleanup.yml` schedules the routine once daily around **03:30 IST** using the same verified VPS SSH secrets and active symlink as production deployment. The job runs only on the live Celebration VPS release. First scheduled run depends on GitHub Actions scheduler, not a hard real-time guarantee.
- Audit script checks admin-only snapshot/notes privacy, no change to customer tracking, legacy checkout barriers and cleanup safeguards.

## Exact workflow for a future Self-Build order

Buyer category selection → verified account draft → upload personal photos (where selected) → backend re-evaluates private internal budget and staff-verified category/size capacity → **create order + snapshot + category unit reservation atomically** → start gateway payment → gateway webhook/return verifies payment → **commit reserved units in the same trusted DB transaction** → admin sees category packing list, request and photos → Celebration packs its chosen category-appropriate designs → courier/packing/order tracking follows the existing operations flow.

No retail SKU mapping at any point. An optional extra request is not automatically priced. Customer retail jewellery photos do not represent an exact promised item in a Self-Build hamper.

## Why the customer checkout is STILL disabled

There is not yet a dedicated, end-to-end validated **Self-Build order creation path** that connects a draft, private photo attachments, the payment provider, admin photo presentation, payment failure/retry/cancel and order status tracking in one coherent transaction-aware lifecycle. The prior reservation functions are tested internally but **not wired into production provider payment callbacks**. It would be unsafe to toggle `customer_enabled` based solely on this milestone.

Remaining work, in order:
1. Introduce a distinct immutable Self-Build order identity and idempotency rules without modifying existing curated/individual purchase contracts.
2. Atomically bind verified draft + photo count + tier full selling price + private internal budget snapshot to a new order and create a bounded reservation with one PG transaction.
3. Reconcile Razorpay/Cashfree async successes and cancellations and reliably release/commit **category inventory**, including late payment captures and retries, after validating payment provider state.
4. Attach uploaded private images to paid/order snapshots so deleting or expiring a draft cannot delete needed order photos, and let authenticated packing staff inspect photos safely.
5. Customer-only My Orders and checkout detail UX, packing workflow and 320/390/768/1280 mobile/Desktop browser E2E regression; ensure no budget leak in HTML/JSON.
6. Obtain owner launch approval and separately remove the hard `customer_enabled=false` CHECK constraint. Never activate with an ad hoc code bypass.

**Current deployed mode:** only existing curated hampers and individual jewellery are purchasable. No Self-Build order or payment can be created by these changes.
