#!/usr/bin/env node
/**
 * CASHFREE TEST MERCHANT ONLY. Never loads the Celebration production env.
 * inspect: GET sandbox order + payment + refunds; refund: OPTIONAL explicit,
 * owner-authorized ₹549 sandbox refund with deterministic idempotency.
 * No website database access, no automatic refund from user cancellation.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
const API="https://sandbox.cashfree.com/pg"
const id=process.env.CASHFREE_REFUND_QA_ORDER_ID?.trim()||""
const action=process.env.CASHFREE_REFUND_QA_ACTION
const approval=process.env.CASHFREE_REFUND_QA_APPROVAL
const appId=process.env.CASHFREE_TEST_APP_ID?.trim()
const secret=process.env.CASHFREE_TEST_SECRET_KEY?.trim()
if(process.env.GITHUB_ACTIONS!=="true" ||
   process.env.CASHFREE_SANDBOX_REFUND_WORKFLOW!=="true" ||
   !["inspect","refund"].includes(action) || !appId || !secret)
  throw Error("CASHFREE_SANDBOX_REFUND_QA_NOT_AUTHORIZED")
if(!/^SBQA_[a-z0-9_]{8,50}$/.test(id) || id.length>45)
  throw Error("CASHFREE_REFUND_ORDER_ID_INVALID")
if(action==="refund" && approval!=="SANDBOX_REFUND_549")
  throw Error("EXPLICIT_SANDBOX_REFUND_CONFIRMATION_REQUIRED")
const headers={
 "Accept":"application/json","Content-Type":"application/json",
 "x-api-version":"2025-01-01","x-client-id":appId,"x-client-secret":secret
}
async function call(path,options={}){
 const response=await fetch(API+path,{...options,headers:{...headers,...options.headers},
   cache:"no-store",signal:AbortSignal.timeout(18000)})
 if(!response.ok)throw Error("CASHFREE_SANDBOX_HTTP_"+response.status)
 return response.json()
}
function safeSummary(r){
 return {id:r.refund_id,status:r.refund_status,amount:r.refund_amount,currency:r.refund_currency}
}
async function main(){
 const encoded=encodeURIComponent(id),prefix="/orders/"+encoded
 const [order, payments]=await Promise.all([
   call(prefix),call(prefix+"/payments")
 ])
 assert.equal(order.order_id,id)
 assert.equal(order.order_currency,"INR")
 assert.equal(order.order_amount,549)
 assert.equal(order.order_status,"PAID","Refund QA requires an already PAID sandbox test order")
 assert.ok(Array.isArray(payments))
 const success=payments.filter(p=>p.payment_status==="SUCCESS")
 assert.equal(success.length,1,"Refund QA needs exactly one successful sandbox payment")
 assert.equal(Number(success[0].payment_amount),549)
 const refundId="SBQA_REF_"+createHash("sha256").update(id).digest("hex").slice(0,22)
 // On review reruns, read the known refund without recreating a transaction.
 let existing=null
 try { existing=await call(prefix+"/refunds/"+encodeURIComponent(refundId)) }
 catch(error){
   if(error?.message!=="CASHFREE_SANDBOX_HTTP_404")throw error
 }
 if(action==="inspect"){
   console.log(JSON.stringify({result:"CASHFREE_SANDBOX_REFUND_READONLY_CHECK_PASSED",
      orderId:id,paymentAmountRupees:549,cashfreeOrderStatus:order.order_status,
      refund:existing?safeSummary(existing):null,refundInitiated:false,productionTouched:false}))
   return
 }
 if(existing){
   assert.equal(existing.refund_id,refundId)
   assert.equal(Number(existing.refund_amount),549)
   console.log(JSON.stringify({result:"CASHFREE_SANDBOX_REFUND_EXISTING_IDEMPOTENT",
     orderId:id,refund:safeSummary(existing),newRefundCreated:false,productionTouched:false}))
   return
 }
 const digest=createHash("sha256").update("celeb-sandbox-refund:"+id).digest("hex")
 const uuid=[digest.slice(0,8),digest.slice(8,12),"4"+digest.slice(13,16),
   "8"+digest.slice(17,20),digest.slice(20,32)].join("-")
 const created=await call(prefix+"/refunds",{
   method:"POST",
   headers:{"x-idempotency-key":uuid},
   body:JSON.stringify({
     refund_amount:549,refund_id:refundId,
     refund_note:"Celebration isolated SANDBOX QA - no real money",
     refund_speed:"STANDARD"
   })
 })
 const entry=Array.isArray(created)?created.find(x=>x.refund_id===refundId):created
 assert.ok(entry,"Cashfree response has no expected refund")
 assert.equal(entry.refund_id,refundId)
 assert.equal(Number(entry.refund_amount),549)
 // A gateway response may be PENDING; do not claim SUCCESS until verified.
 const verified=await call(prefix+"/refunds/"+encodeURIComponent(refundId))
 assert.equal(verified.refund_id,refundId)
 assert.equal(Number(verified.refund_amount),549)
 assert.ok(["SUCCESS","PENDING","PENDING_APPROVAL","CANCELLED","ONHOLD","REJECTED"]
   .includes(verified.refund_status),"Unknown refund status")
 console.log(JSON.stringify({result:"CASHFREE_SANDBOX_REFUND_CREATED_AND_LOOKED_UP",
  orderId:id,refund:safeSummary(verified),
  completed:verified.refund_status==="SUCCESS",
  note:"A created refund is NOT automatically a completed refund.",
  productionTouched:false}))
}
main().catch(error=>{
 console.error("CASHFREE_SANDBOX_REFUND_QA_FAILED:",
    error instanceof Error?error.message:"UNKNOWN_ERROR")
 process.exitCode=1
})
