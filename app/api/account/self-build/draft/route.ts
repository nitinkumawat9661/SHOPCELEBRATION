import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { getCustomerSession } from "../../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import {
  customerSelfBuildEnabled,deleteSelfBuildDraft,getSelfBuildDraft,
  saveSelfBuildDraft,SelfBuildDraftError
} from "../../../../../lib/server/self-build-drafts"

// Staged customer draft API. Hard-disabled by DB gate until owner-approved
// complete stock/payment/order launch. No order/quote/item cost is returned.
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
function response(error:string,status:number){return NextResponse.json({ok:false,error},{status,headers:noStore})}
async function access(){
  const session=await getCustomerSession()
  if(!session)return {code:"AUTH_REQUIRED",status:401} as const
  if(!await customerSelfBuildEnabled())return {code:"SELF_BUILD_NOT_LIVE",status:403} as const
  return {id:session.accountId} as const
}
function fail(error:unknown){
  if(error instanceof RequestSecurityError || error instanceof SelfBuildDraftError)
    return response(error.code,error.status)
  console.error("self-build-customer-draft",error)
  return response("DRAFT_UNAVAILABLE",503)
}
export async function GET(){
  try{
    const a=await access()
    if("code" in a)return response(a.code,a.status)
    return NextResponse.json({ok:true,draft:await getSelfBuildDraft(a.id)},{headers:noStore})
  }catch(error){return fail(error)}
}
export async function PUT(request:Request){
  try{
    enforceSameOrigin(request)
    const a=await access()
    if("code" in a)return response(a.code,a.status)
    const allowed=await consumeRequestRateLimit("customer-self-build-draft",request,validation.rateLimits.customerMutation)
    if(!allowed)return response("RATE_LIMITED",429)
    const body=await readJsonBody<unknown>(request)
    return NextResponse.json({ok:true,draft:await saveSelfBuildDraft(a.id,body)},{headers:noStore})
  }catch(error){return fail(error)}
}
export async function DELETE(request:Request){
  try{
    enforceSameOrigin(request)
    // Signed-in users can clear previously saved drafts even if buying mode
    // was subsequently disabled, and are never allowed to touch other owners.
    const session=await getCustomerSession()
    if(!session)return response("AUTH_REQUIRED",401)
    const allowed=await consumeRequestRateLimit("customer-self-build-draft",request,validation.rateLimits.customerMutation)
    if(!allowed)return response("RATE_LIMITED",429)
    await deleteSelfBuildDraft(session.accountId)
    return NextResponse.json({ok:true},{headers:noStore})
  }catch(error){return fail(error)}
}
