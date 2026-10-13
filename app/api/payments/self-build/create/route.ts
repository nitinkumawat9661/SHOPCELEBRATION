import { NextResponse } from "next/server"
import { paymentGatewayConfig, paymentGatewayReady } from "../../../../../config/payment-gateway"
import { routes } from "../../../../../config/routes"
import { validation } from "../../../../../config/validation"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { getCustomerSession } from "../../../../../lib/security/customer-session"
import { findCustomerAccountById } from "../../../../../lib/server/customer-accounts"
import { createSelfBuildNoInventoryOrder, SelfBuildCheckoutError } from "../../../../../lib/server/orders/self-build-no-inventory"
import { createProviderCheckout, type ProviderCheckout } from "../../../../../lib/server/payments/provider"
import { bindPaymentAttempt, failPaymentAttempt, getPaymentOrder, paymentOrderClientResult, reservePaymentAttempt } from "../../../../../lib/server/payments/store"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { customerSelfBuildEnabled } from "../../../../../lib/server/self-build-drafts"
import type { CreateOrderInput } from "../../../../../lib/domain/order"
import { OrderValidationError } from "../../../../../lib/domain/order"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
type Body={draftId?:unknown;customerDetails?:CreateOrderInput}
function deny(code:string,status:number){
  return NextResponse.json({ok:false,error:code},{status,headers:noStore})
}
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
  let saved:{publicId:string;accountId:string}|null=null
  try{
    enforceSameOrigin(request)
    const session=await getCustomerSession()
    if(!session)return deny("AUTH_REQUIRED",401)
    // Hardened DB launch gate check occurs BEFORE creating order / gateway
    // interaction, AND again inside the atomic order transaction.
    if(!await customerSelfBuildEnabled())return deny("SELF_BUILD_NOT_LIVE",403)
    if(!paymentGatewayReady()||!paymentGatewayConfig.provider)
      return deny("PAYMENT_GATEWAY_NOT_CONFIGURED",503)
    const account=await findCustomerAccountById(session.accountId)
    if(!account)return deny("AUTH_REQUIRED",401)
    if(!await consumeRequestRateLimit("payment-self-build",request,validation.rateLimits.createOrder))
      return deny("RATE_LIMITED",429)
    const body=await readJsonBody<Body>(request,validation.catalogRequestMaxBytes)
    if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.draftId!=="string"||
       !body.customerDetails||typeof body.customerDetails!=="object"||Array.isArray(body.customerDetails))
      return deny("SELF_BUILD_INVALID_CHECKOUT",422)
    const created=await createSelfBuildNoInventoryOrder({
      accountId:account.id,draftId:body.draftId,customerDetails:body.customerDetails,
      paymentProvider:paymentGatewayConfig.provider
    })
    saved={publicId:created.orderId,accountId:account.id}
    const reserved=await reservePaymentAttempt(created.orderId,account.id,paymentGatewayConfig.provider)
    attemptId=reserved.attemptId
    const clientOrder=paymentOrderClientResult(reserved.order)
    const trackingPath=`${routes.track}#order=${encodeURIComponent(clientOrder.trackingToken)}`
    if(reserved.order.paymentStatus==="paid"||reserved.order.status==="payment_verified"){
      return NextResponse.json({ok:true,paid:true,...clientOrder,trackingPath},{headers:noStore})
    }
    const checkout=reserved.reusable
      ?reusable({...reserved.reusable,amountPaise:reserved.order.amountPaise})
      :await createProviderCheckout({
        publicOrderId:reserved.order.publicId,
        providerReference:reserved.providerReference,
        amountPaise:reserved.order.amountPaise,
        customerAccountId:account.id,customerName:account.displayName,customerPhone:account.phone
      })
    if(!reserved.reusable)await bindPaymentAttempt(reserved.attemptId,checkout)
    return NextResponse.json({ok:true,paid:false,...clientOrder,trackingPath,checkout},{headers:noStore})
  }catch(error){
    if(attemptId)await failPaymentAttempt(attemptId,"PAYMENT_PROVIDER_UNAVAILABLE").catch(()=>{})
    if(error instanceof RequestSecurityError)return deny(error.code,error.status)
    if(error instanceof SelfBuildCheckoutError)return deny(error.code,
      error.code==="SELF_BUILD_NOT_LIVE"?403:409)
    if(error instanceof OrderValidationError)return deny(error.code,422)
    const snapshot=saved?await getPaymentOrder(saved.publicId,saved.accountId).catch(()=>null):null
    const result=snapshot?paymentOrderClientResult(snapshot):null
    // Do not log personal notes, address or private storage keys.
    console.error("self-build-payment-create-error")
    return NextResponse.json({ok:false,error:"SELF_BUILD_PAYMENT_UNAVAILABLE",...(result||{})},
      {status:503,headers:noStore})
  }
}
