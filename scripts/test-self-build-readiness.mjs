import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { evaluateLaunchReadiness } from "./audit-self-build-readiness.mjs"

const read=path=>{const file=new URL("../"+path,import.meta.url);return path.startsWith(".github/")&&!existsSync(file)?Promise.resolve(""):readFile(file,"utf8")}
const [source, workflow, packageRaw, existingCheckout] = await Promise.all([
  "scripts/audit-self-build-readiness.mjs",
  ".github/workflows/self-build-readonly-readiness.yml",
  "package.json",
  "app/api/payments/create/route.ts"
].map(read))
assert(source.includes('BEGIN READ ONLY') && source.includes("ROLLBACK"),"Audit must never write to production database")
assert(source.includes("customer_enabled !== false") && source.includes("show_item_prices !== false"),"Staged hard gates cannot be bypassed")
assert(!source.includes("INSERT INTO") && !source.includes("UPDATE self_build") && !source.includes("DELETE FROM"),"No mutation SQL")
assert(!source.includes("SELECT *") && !source.includes("photo_object_key") && !source.includes("object_key"),"No secret fields selected")
assert(source.includes("gateway_payment_and_order_idempotency_e2e_not_signed_off"),"Never infer launch readiness from DB stock counts")
if(workflow) assert(workflow.includes("StrictHostKeyChecking=yes") && workflow.includes("readlink -f"),"Use verified SSH and active release")
if(workflow) assert(workflow.includes("workflow_run:") && workflow.includes("Deploy Celebration Production"),"Readiness runs after healthy deploy")
assert((!workflow || workflow.includes("self-build-readiness.mjs")) && packageRaw.includes("test-self-build-readiness.mjs"),"QA is always executed")
assert(existingCheckout.includes("SELF_BUILD_NOT_LIVE"),"Legacy payment cannot silently enable self-build")

const blocked = evaluateLaunchReadiness({
  config:{customer_enabled:false,show_item_prices:false},
  categories:{active:8,ready:0},options:{active:12,ready:0},tiers:{enabled:0},
  openHolds:0,expiredDrafts:0
})
assert.equal(blocked.launchReady,false)
assert.equal(blocked.customerCheckoutEnabled,false)
assert(blocked.remainingGates.includes("no_sellable_category_capacity_verified"))
assert(blocked.remainingGates.includes("private_tier_allowances_not_configured"))
const needsPayment = evaluateLaunchReadiness({
  config:{customer_enabled:false,show_item_prices:false},
  categories:{active:8,ready:8},options:{active:12,ready:12},tiers:{enabled:7},
  openHolds:0,expiredDrafts:0
})
assert.equal(needsPayment.launchReady,false,"Verified stock never implies payment-integrated checkout")
assert(needsPayment.remainingGates.includes("gateway_payment_and_order_idempotency_e2e_not_signed_off"))
assert.throws(()=>evaluateLaunchReadiness({
  config:{customer_enabled:true,show_item_prices:false},
  categories:{active:0,ready:0},options:{active:0,ready:0},tiers:{enabled:0},
  openHolds:0,expiredDrafts:0
}),/SELF_BUILD_HARD_LAUNCH_GATE_MISMATCH/)
console.log("SELF_BUILD_READINESS_TESTS_PASSED: staging gate, customer safety, read-only DB, privacy and owner approval")
