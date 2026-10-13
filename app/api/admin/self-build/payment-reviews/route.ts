import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin,readJsonBody,RequestSecurityError } from "../../../../../lib/security/request"
import { validation } from "../../../../../config/validation"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { documentSelfBuildRefundReference,listSelfBuildPaymentReviews,
  selfBuildReviewReasons,type SelfBuildReviewReason } from "../../../../../lib/server/self-build-payment-reviews"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
function response(code:string,status:number){return NextResponse.json({ok:false,error:code},{status,headers:noStore})}
export async function GET() {
  if(!await isAdminRequest())return response("UNAUTHORIZED",401)
  try{return NextResponse.json({ok:true,reviews:await listSelfBuildPaymentReviews()},{headers:noStore})}
  catch{console.error("admin-self-build-refund-review-read-unavailable");return response("REVIEWS_UNAVAILABLE",503)}
}
export async function POST(request:Request){
  if(!await isAdminRequest())return response("UNAUTHORIZED",401)
  try{
    enforceSameOrigin(request)
    if(!await consumeRequestRateLimit("admin-payment-review",request,validation.rateLimits.adminMutation))
      return response("RATE_LIMITED",429)
    const body=await readJsonBody<{publicOrderId?:unknown;reason?:unknown;externalReference?:unknown;note?:unknown}>(request)
    if(!body||typeof body.publicOrderId!=="string"||
       typeof body.reason!=="string"||!selfBuildReviewReasons.includes(body.reason as SelfBuildReviewReason)||
       typeof body.externalReference!=="string"||typeof body.note!=="string")
      return response("INVALID_REFUND_DOCUMENTATION",422)
    await documentSelfBuildRefundReference({
      publicOrderId:body.publicOrderId,reason:body.reason as SelfBuildReviewReason,
      externalReference:body.externalReference,note:body.note
    })
    return NextResponse.json({ok:true,documented:true},{headers:noStore})
  }catch(error){
    if(error instanceof RequestSecurityError)return response(error.code,error.status)
    if(error instanceof Error&&["INVALID_REFUND_DOCUMENTATION","PAYMENT_REVIEW_NOT_OPEN"].includes(error.message))
      return response(error.message,422)
    console.error("admin-self-build-refund-review-unavailable")
    return response("REVIEW_UPDATE_FAILED",503)
  }
}
