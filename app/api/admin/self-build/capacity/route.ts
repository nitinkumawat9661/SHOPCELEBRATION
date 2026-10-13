import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { isAdminRequest } from "../../../../../lib/security/admin-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { SelfBuildAdminError } from "../../../../../lib/server/self-build-admin"
import { getSelfBuildCapacityState, saveSelfBuildCapacityState } from "../../../../../lib/server/self-build-capacity"

// ADMIN ONLY. This data is private fulfilment capacity and internal tier budget.
// Never import into buyer storefront code or expose through a customer API.
export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store" }

export async function GET() {
  if(!await isAdminRequest())return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401,headers:privateHeaders})
  try {
    const state=await getSelfBuildCapacityState()
    return NextResponse.json({ok:true,...state},{headers:privateHeaders})
  } catch(error){
    console.error("self-build-capacity-read",error)
    return NextResponse.json({ok:false,error:"CAPACITY_UNAVAILABLE"},{status:503,headers:privateHeaders})
  }
}
export async function PATCH(request:Request) {
  if(!await isAdminRequest())return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401,headers:privateHeaders})
  try {
    enforceSameOrigin(request)
    const allowed=await consumeRequestRateLimit("admin-self-build-capacity",request,validation.rateLimits.adminMutation)
    if(!allowed)return NextResponse.json({ok:false,error:"RATE_LIMITED"},{status:429,headers:privateHeaders})
    const body=await readJsonBody<unknown>(request,validation.catalogRequestMaxBytes)
    const state=await saveSelfBuildCapacityState(body)
    return NextResponse.json({ok:true,...state},{headers:privateHeaders})
  } catch(error) {
    if(error instanceof RequestSecurityError)
      return NextResponse.json({ok:false,error:error.code},{status:error.status,headers:privateHeaders})
    if(error instanceof SelfBuildAdminError)
      return NextResponse.json({ok:false,error:error.code},{
        status:error.code==="STALE_SELF_BUILD_CAPACITY"?409:422,headers:privateHeaders})
    console.error("self-build-capacity-save",error)
    return NextResponse.json({ok:false,error:"CAPACITY_SAVE_FAILED"},{status:503,headers:privateHeaders})
  }
}
