#!/usr/bin/env node
/**
 * Manual Cashfree SANDBOX-only payment QA, never a Celebration production checkout.
 * Modes: create (two test orders) | verify (one previously-created test order).
 * Secrets only via GitHub environment. No website database, VPS or live API.
 */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"

const baseUrl = "https://sandbox.cashfree.com/pg"
const amount = 549 // ₹499 tier + ₹50 delivery
const appId = process.env.CASHFREE_TEST_APP_ID?.trim()
const secretKey = process.env.CASHFREE_TEST_SECRET_KEY?.trim()
const action = process.env.CASHFREE_QA_ACTION
if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.CASHFREE_SANDBOX_QA_APPROVED !== "true" ||
    !["create", "verify"].includes(action)) {
  console.error("CASHFREE_QA_MANUAL_SANDBOX_WORKFLOW_ONLY")
  process.exit(1)
}
if (!appId || !secretKey) {
  console.error("CASHFREE_SANDBOX_KEYS_MISSING")
  process.exit(1)
}
const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "x-client-id": appId,
  "x-client-secret": secretKey,
  "x-api-version": "2025-01-01"
}
async function provider(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(20000)
  })
  // Never print provider JSON or secrets; codes are enough for diagnostics.
  if (!response.ok) throw new Error("CASHFREE_SANDBOX_HTTP_" + response.status + "_" + path.split("/")[1])
  return response.json()
}
function normalizePayments(payments) {
  assert.ok(Array.isArray(payments), "CASHFREE_PAYMENTS_INVALID")
  const paid = payments.find(p => p.payment_status === "SUCCESS")
  const failed = payments.filter(p => ["FAILED", "USER_DROPPED"].includes(p.payment_status))
  const status = paid ? "paid" :
    payments.some(p => p.payment_status === "PENDING" || p.payment_status === "NOT_ATTEMPTED") ?
      "pending" : failed.length > 0 ? "failed" : "pending"
  for (const p of payments) {
    if (p.payment_amount != null && Number(p.payment_amount) !== amount)
      throw new Error("CASHFREE_SANDBOX_PAYMENT_AMOUNT_MISMATCH")
  }
  return {status,attempts:payments.length,failedAttempts:failed.length,
    paidPayments:paid ? 1 : 0,userDropped:payments.some(p=>p.payment_status==="USER_DROPPED")}
}
async function verifyOne(id, expected) {
  if (!/^SBQA_[a-z0-9_]{8,50}$/.test(id || "")) throw new Error("INVALID_SANDBOX_ORDER_ID")
  const order = await provider("/orders/" + encodeURIComponent(id))
  assert.equal(order.order_id,id)
  assert.equal(order.order_amount,amount)
  assert.equal(order.order_currency,"INR")
  const payments = await provider("/orders/" + encodeURIComponent(id) + "/payments")
  const result = normalizePayments(payments)
  if (expected && result.status !== expected)
    throw new Error("CASHFREE_QA_UNEXPECTED_STATUS_" + result.status.toUpperCase() +
      "_EXPECTED_" + expected.toUpperCase())
  if (result.status === "paid") assert.equal(order.order_status, "PAID")
  if (result.status !== "paid") assert.notEqual(order.order_status, "PAID")
  console.log(JSON.stringify({result:"CASHFREE_SANDBOX_VERIFICATION_PASSED",
    orderId:id,rupees:amount,cashfreeOrderStatus:order.order_status,...result,
    expectedStatus:expected||null,productionTouched:false}))
}
async function createPair() {
  const dir="cashfree-qa-artifact"
  await mkdir(dir,{recursive:true})
  const generated=[]
  for (const scenario of ["success","failure"]) {
    const id="SBQA_"+Date.now().toString(36)+"_"+scenario[0]+
      randomBytes(4).toString("hex")
    const order=await provider("/orders", {
      method:"POST",
      body: JSON.stringify({
        order_id:id, order_amount:amount,order_currency:"INR",
        customer_details:{
          customer_id:"celebration_cashfree_sandbox_only",
          customer_name:"Celebration Sandbox",
          customer_phone:"9999999999"
        },
        order_meta:{
          // Official Cashfree Dev Studio page handles checkout returns.
          // No production callback, webhook or site database involved.
          return_url:"https://www.cashfree.com/devstudio/preview/pg/web/checkout?order_id={order_id}"
        },
        order_note:"CELEBRATION_SANDBOX_"+scenario
      })
    })
    assert.equal(order.order_id,id)
    assert.equal(order.order_amount,amount)
    assert.equal(order.order_currency,"INR")
    assert.ok(order.payment_session_id?.startsWith("session_"),
      "CASHFREE_TEST_SESSION_MISSING")
    generated.push({scenario,orderId:id,paymentSessionId:order.payment_session_id,
      amountRupees:amount})
    // Confirm persisted order from Cashfree, not just the creation response.
    const stored=await provider("/orders/"+encodeURIComponent(id))
    assert.equal(stored.order_amount,amount)
    assert.equal(stored.order_status,"ACTIVE")
    const payments=await provider("/orders/"+encodeURIComponent(id)+"/payments")
    assert.equal(normalizePayments(payments).status,"pending")
  }
  await writeFile(dir+"/sessions.json",JSON.stringify({
    sandbox:true,source:"Cashfree merchant test environment",orders:generated
  },null,2)+"\n",{mode:0o600})
  await writeFile(dir+"/README.txt",
    "CELEBRATION CASHFREE SANDBOX PAYMENT QA\n\n"+
    "Go to https://www.cashfree.com/devstudio/preview/pg/web/checkout\n"+
    "Scroll to 'Load Checkout' (step 4). Set environment Sandbox.\n"+
    "Use the paymentSessionId from sessions.json in the input and click Proceed to Pay.\n"+
    "SUCCESS test: card 4706131211212123; expiry 03/2028, CVV 123, OTP 111000, name Test.\n"+
    "FAILURE test: if UPI Collect is available use testfailure@gocash; alternatively abandon\n"+
    "checkout to test user-dropped separately.\n"+
    "Do not enter real card or bank details. No money is charged in Sandbox.\n"+
    "Verify each order afterward with the GitHub workflow in verify mode.\n"+
    "WARNING: Payment sessions grant sandbox checkout access: do not post sessions publicly.\n")
  console.log(JSON.stringify({
    result:"CASHFREE_SANDBOX_CHECKOUT_SESSIONS_READY",
    testOrders:generated.map(({scenario,orderId,amountRupees})=>({scenario,orderId,amountRupees})),
    artifact:"cashfree-qa-artifact/sessions.json",
    noPaymentCompleted:true,productionTouched:false
  }))
}
try {
  if (action==="create") await createPair()
  else {
    const id=process.env.CASHFREE_QA_ORDER_ID?.trim()
    const expected=process.env.CASHFREE_QA_EXPECTED_STATUS?.trim()
    if (!["paid","failed","pending"].includes(expected))
      throw new Error("CASHFREE_QA_EXPECTED_STATUS_INVALID")
    await verifyOne(id,expected)
  }
} catch (e) {
  // Never dump full Cashfree error payload or headers.
  console.error("CASHFREE_SANDBOX_QA_FAILED:",e instanceof Error?e.message:"UNKNOWN_ERROR")
  process.exitCode=1
}
