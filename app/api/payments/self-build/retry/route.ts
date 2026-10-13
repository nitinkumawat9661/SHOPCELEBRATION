import { NextResponse } from "next/server"
import { paymentGatewayConfig,paymentGatewayReady } from "../../../../../config/payment-gateway"
import { routes } from "../../../../../config/routes"
import { validation } from "../../../../../config/validation"
import { getCustomerSession } from "../../../../../lib/security/customer-session"
import { enforceSameOrigin,readJsonBody,RequestSecurityError } from "../../../../../lib/security/request"
import { findCustomerAccountById } from "../../../../../lib/server/customer-accounts"
import { customerSelfBuildEnabled } from "../../../../../lib/server/self-build-drafts"
import { query } from "../../../../../lib/server/db"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { createProviderCheckout,type ProviderCheckout } from "../../../../../lib/server/payments/provider"
import { reservePaymentAttempt,bindPaymentAttempt,failPaymentAttempt,getPaymentOrder,paymentOrderClientResult } from "../../../../../lib/server/payments/store"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
type Body={publicOrderId?:unknown}
function error(code:string,status:number){return NextResponse.json({ok:false,error:code},{headers:noStore,status})}
function reusable(input:{provider:"razorpay"|"cashfree";providerOrderId:string;providerSessionId:string|null;amountPaise:number}):ProviderCheckout{
  if(input.provider==="razorpay")return{
    provider:"razorpay",mode:paymentGatewayConfig.mode,providerOrderId:input.providerOrderId,
    keyId:paymentGatewayConfig.razorpay.keyId,amountPaise:input.amountPaise,currency:"INR"
  }
  if(!input.providerSessionId)throw Error("PAYMENT_SESSION_MISSING")
  return{provider:"cashfree",mode:paymentGatewayConfig.mode,providerOrderId:input.providerOrderId,
    paymentSessionId:input.providerSessionId,amountPaise:input.amountPaise,currency:"INR"}
}
export async function POST(request:Request){
  let attemptId=""
  try{
    enforceSameOrigin(request)
    const session=await getCustomerSession()
    if(!session)return error("AUTH_REQUIRED",401)
    if(!await customerSelfBuildEnabled())return error("SELF_BUILD_NOT_LIVE",403)
    if(!paymentGatewayReady()||!paymentGatewayConfig.provider)
      return error("PAYMENT_GATEWAY_NOT_CONFIGURED",503)
    const account=await findCustomerAccountById(session.accountId)
    if(!account)return error("AUTH_REQUIRED",401)
    if(!await consumeRequestRateLimit("payment-self-build-retry",request,validation.rateLimits.createOrder))
      return error("RATE_LIMITED",429)
    const body=await readJsonBody<Body>(request)
    const publicId=typeof body?.publicOrderId==="string"?body.publicOrderId.trim():""
    if(!/^[A-Za-z0-9-]{6,80}$/.test(publicId))return error("PAYMENT_ORDER_NOT_FOUND",404)
    // Require buyer-owned Self-Build snapshot AND the NO-INVENTORY order mode.
    const own=await query<{id:string}>(`
      SELECT o.id FROM orders o JOIN self_build_order_snapshots s ON s.order_id=o.id
      WHERE o.public_id=$1 AND o.customer_account_id=$2
        AND NOT EXISTS(SELECT 1 FROM self_build_order_reservation_batches b WHERE b.order_id=o.id)
      LIMIT 1`,[publicId,account.id])
    if(!own.rows.length)return error("PAYMENT_ORDER_NOT_FOUND",404)
    const reserved=await reservePaymentAttempt(publicId,account.id,paymentGatewayConfig.provider)
    attemptId=reserved.attemptId
    const clientOrder=paymentOrderClientResult(reserved.order)
    const trackingPath=`${routes.track}#order=${encodeURIComponent(clientOrder.trackingToken)}`
    if(reserved.order.paymentStatus==="paid"||reserved.order.status==="payment_verified")
      return NextResponse.json({ok:true,paid:true,...clientOrder,trackingPath},{headers:noStore})
    const checkout=reserved.reusable
      ?reusable({...reserved.reusable,amountPaise:reserved.order.amountPaise})
      :await createProviderCheckout({
        publicOrderId:reserved.order.publicId,providerReference:reserved.providerReference,
        amountPaise:reserved.order.amountPaise,customerAccountId:account.id,
        customerName:account.displayName,customerPhone:account.phone
      })
    if(!reserved.reusable)await bindPaymentAttempt(reserved.attemptId,checkout)
    return NextResponse.json({ok:true,paid:false,...clientOrder,trackingPath,checkout},{headers:noStore})
  }catch(e){
    if(attemptId)await failPaymentAttempt(attemptId,"PAYMENT_RETRY_UNAVAILABLE").catch(()=>{})
    if(e instanceof RequestSecurityError)return error(e.code,e.status)
    if(e instanceof Error&&e.message==="PAYMENT_ORDER_CANCELLED")return error(e.message,409)
    console.error("self-build-payment-retry-unavailable")
    return error("PAYMENT_RETRY_UNAVAILABLE",503)
  }
}
