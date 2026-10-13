import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
const read=path=>{const file=new URL("../"+path,import.meta.url);return path.startsWith(".github/")&&!existsSync(file)?Promise.resolve(""):readFile(file,"utf8")}
const [adminRead,domainType,adminType,orderUi,styles,adminRoute,customerOrders,customerTrack,manualOrder,paymentCreate,cleaner,cleanupWorkflow]=await Promise.all([
 "lib/server/orders/read.ts","lib/server/orders/types.ts","features/admin/types.ts",
 "features/admin/AdminOrderCard.tsx","styles/admin-self-build-20261013.css",
 "app/api/admin/orders/route.ts","app/api/account/orders/route.ts",
 "lib/server/orders/types.ts","app/api/orders/route.ts","app/api/payments/create/route.ts",
 "scripts/cleanup-self-build-staging.mjs",".github/workflows/self-build-staging-cleanup.yml"
].map(read))
assert(adminRead.includes("self_build_order_snapshots")&&adminRead.includes("self_build_order_reservation_batches"),"Admin shows real preserved snapshots")
assert(adminRead.includes("LEFT JOIN self_build_order_reservation_batches"),"Optional reservation must not hide a frozen snapshot")
assert(adminRead.includes("ANY($1::text[])"),"Only selected admin order IDs")
assert(adminRead.includes("other_request_text"),"Customer request visible to owner")
assert(adminRead.includes("reservationStatus")&&adminRead.includes("selections"),"Admin snapshot whitelisting")
for(const blocked of ["total_internal_budget_paise","tier_budget_paise","object_key"])assert(!adminRead.includes(blocked),"No private internal budget or photo key to browser: "+blocked)
assert(domainType.includes("selfBuild?:")&&adminType.includes("selfBuild?:"))
assert(orderUi.includes('order.selfBuild ? "Self-Build Hamper"')&&orderUi.includes("Self-Build packing list"))
assert(orderUi.includes("order.selfBuild.selections.map")&&orderUi.includes("otherRequestText")&&orderUi.includes("reservationStatus"))
assert(styles.includes(".sbAdminOrderSnapshot")&&styles.includes(".sbAdminOrderSnapshotItems"))
assert(adminRoute.includes("await isAdminRequest()"),"Admin order route remains authenticated")
assert(!customerOrders.includes("self_build_order_snapshots")&&!customerTrack.includes("self_build_order_snapshots"),"Customer-facing read cannot access private snapshots")
assert(!manualOrder.includes("self-build-reservations")&&!paymentCreate.includes("self-build-reservations"),"Existing shopping checkout isolated from prelaunch staging")
for(const route of [manualOrder,paymentCreate])assert(route.includes('payload.selfBuildDraftId !== undefined')&&route.includes('SELF_BUILD_NOT_LIVE'),"Explicit self-build fields must not be silently reinterpreted as curated orders")
assert(cleaner.includes("pg_try_advisory_lock"),"Cron instances serialize")
assert(cleaner.includes("WHERE expires_at<now()")&&cleaner.includes("FOR UPDATE"),"Only expired and locked draft records")
assert(cleaner.includes("DeleteObjectCommand")&&cleaner.includes("DELETE FROM self_build_drafts"),"Delete private R2 bytes and DB metadata")
assert(cleaner.includes("await lock.query(\"ROLLBACK\")")&&cleaner.includes("throw error"),"Fail-safe cleanup rollback")
assert(cleaner.includes("expiredHoldsAwaitingPaymentReconciliation"),"Do not automatically release paid/unknown provider holds")
assert(!cleaner.includes("releaseSelfBuildReservationWithClient"),"No blind release before provider confirmation")
if(cleanupWorkflow){
  assert(cleanupWorkflow.includes("schedule:")&&cleanupWorkflow.includes("VPS_KNOWN_HOSTS"))
  assert(cleanupWorkflow.includes("StrictHostKeyChecking=yes")&&cleanupWorkflow.includes("readlink -f"),"Cleanup only runs on authenticated VPS active release")
} // Production archives deliberately exclude .github; workflow validated in GitHub PR checkout.
const atomicCreator=await read("lib/server/orders/self-build-create.ts")
const existingCreator=await read("lib/server/orders/create.ts")
assert(atomicCreator.includes("createStagedSelfBuildOrderWithClient")&&atomicCreator.includes("transaction(client=>"),"Single atomic transaction for order and reservations")
assert(atomicCreator.includes("createOrderWithClient(client")&&atomicCreator.includes("reserveSelfBuildForOrderWithClient(client"),"Reuse validated pricing/order engine and transactional reservation")
assert(atomicCreator.includes("SELECT customer_enabled,show_item_prices")&&atomicCreator.includes("SELF_BUILD_NOT_LIVE"),"Staging gate must fail before order insert")
assert(atomicCreator.includes("customer_account_id=$2")&&atomicCreator.includes("expires_at>now()"),"Only own unexpired draft")
assert(atomicCreator.includes("normalizeOrderInput")&&atomicCreator.includes("selectedProductIds:[]"),"No posted costs or retail SKU mapping")
assert(atomicCreator.includes("SELF_BUILD_PHOTO_ORDER_RETENTION_NOT_READY"),"Do not accept photo-bearing paid orders before retention support")
assert(atomicCreator.includes("SELF_BUILD_IDEMPOTENCY_COLLISION")&&existingCreator.includes("created: false as const"),"Curated UUID collisions must not get reinterpreted")
assert(!manualOrder.includes("createStagedSelfBuildOrder")&&!paymentCreate.includes("createStagedSelfBuildOrder"),"Customer checkout stays disconnected")
console.log("Phase 3 Self-Build: admin order snapshot privacy, unchanged curated checkout, and fail-closed private R2 cron cleanup audit passed.")
