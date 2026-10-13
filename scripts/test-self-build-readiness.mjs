import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { evaluateLaunchReadiness } from "./audit-self-build-readiness.mjs"

// Production source archives exclude .github; the full PR validates workflow.
const read=path=>{
  const file=new URL("../"+path,import.meta.url)
  return path.startsWith(".github/")&&!existsSync(file)?Promise.resolve(""):readFile(file,"utf8")
}
const [source, workflow, packageRaw, existingCheckout, selfBuildCheckout] = await Promise.all([
  "scripts/audit-self-build-readiness.mjs",
  ".github/workflows/self-build-readonly-readiness.yml",
  "package.json",
  "app/api/payments/create/route.ts",
  "app/api/payments/self-build/create/route.ts"
].map(read))
assert(source.includes("BEGIN READ ONLY") && source.includes("ROLLBACK"),"Never write to production DB")
assert(source.includes("customer_enabled !== false") && source.includes("show_item_prices !== false"),
  "Staging hard gates must not be bypassed")
assert(!source.includes("INSERT INTO") && !source.includes("UPDATE self_build") &&
  !source.includes("DELETE FROM"),"Zero mutation SQL")
assert(!source.includes("SELECT *")&&!source.includes("photo_object_key")&&
  !source.includes("object_key"),"Do not select private files or personal data")
assert(!source.includes("self_build_category_capacity")&&!source.includes("self_build_option_capacity") &&
  !source.includes("self_build_order_reservation_batches")&&!source.includes("reserved_units")&&
  !source.includes("available_units"),"NO INVENTORY or capacity table access even in readiness monitor")
assert(source.includes("gateway_sandbox_success_failure_retry_refund_not_signed_off"),
  "Source audit cannot claim payment/refunds were exercised in merchant sandbox")
if(workflow){
  assert(workflow.includes("StrictHostKeyChecking=yes") && workflow.includes("readlink -f"),
    "Verify SSH host and active release")
  assert(workflow.includes("workflow_run:") && workflow.includes("Deploy Celebration Production"),
    "Run preflight only following successful production deploy")
  assert(workflow.includes("self-build-readiness.mjs"),"VPS job must execute actual monitor")
}
assert(packageRaw.includes("test-self-build-readiness.mjs"),"Audit is always executed")
assert(existingCheckout.includes("SELF_BUILD_NOT_LIVE"),"Legacy payments do not enable Self-Build")
assert(selfBuildCheckout.includes("customerSelfBuildEnabled()"),"Dedicated payment checkout hard-gated")
const blocked = evaluateLaunchReadiness({
  config:{customer_enabled:false,show_item_prices:false},
  categories:{active:8},options:{active:12},tiers:{enabled:0},expiredDrafts:0
})
assert.equal(blocked.launchReady,false)
assert.equal(blocked.customerCheckoutEnabled,false)
assert.equal(blocked.inventoryRequired,false)
assert(!blocked.remainingGates.some(x=>/stock|capacity|inventory|reservation/.test(x)),
  "Stock and category capacity are NOT launch requirements")
assert(blocked.remainingGates.includes("private_tier_allowances_not_configured"))
const better = evaluateLaunchReadiness({
  config:{customer_enabled:false,show_item_prices:false},
  categories:{active:8},options:{active:12},tiers:{enabled:7},expiredDrafts:0
})
assert.equal(better.launchReady,false,"Even without inventory checks gateway approval is mandatory")
assert(better.remainingGates.includes("gateway_sandbox_success_failure_retry_refund_not_signed_off"))
assert.throws(()=>evaluateLaunchReadiness({
  config:{customer_enabled:true,show_item_prices:false},
  categories:{active:0},options:{active:0},tiers:{enabled:0},expiredDrafts:0
}),/SELF_BUILD_HARD_LAUNCH_GATE_MISMATCH/)
console.log("SELF_BUILD_READINESS_TESTS_PASSED: no-stock/read-only checks, hard DB gate, private budget, merchant sandbox, photo retention and owner approval")
