import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../../lib/security/request"
import { validation } from "../../../../../../config/validation"
import { consumeRequestRateLimit } from "../../../../../../lib/server/rate-limit"
import { SelfBuildDraftError } from "../../../../../../lib/server/self-build-drafts"
import { deleteOwnedSelfBuildPhoto, readOwnedSelfBuildPhoto } from "../../../../../../lib/server/self-build-photos"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
type Context={params:Promise<{id:string}>}
function fail(code:string,status:number){return NextResponse.json({ok:false,error:code},{status,headers:noStore})}
function response(error:unknown){
  if(error instanceof SelfBuildDraftError||error instanceof RequestSecurityError)
    return fail(error.code,error.status)
  console.error("self-build-private-photo",error)
  return fail("PRIVATE_PHOTO_UNAVAILABLE",503)
}
export async function GET(_request:Request,context:Context){
  try{
    const session=await getCustomerSession()
    if(!session)return fail("AUTH_REQUIRED",401)
    const {id}=await context.params
    const bytes=await readOwnedSelfBuildPhoto(session.accountId,id)
    return new NextResponse(new Uint8Array(bytes),{headers:{
      ...noStore,"Content-Type":"image/webp","X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'none'; sandbox"
    }})
  }catch(e){return response(e)}
}
export async function DELETE(request:Request,context:Context){
  try{
    enforceSameOrigin(request)
    const session=await getCustomerSession()
    if(!session)return fail("AUTH_REQUIRED",401)
    if(!await consumeRequestRateLimit("customer-self-build-photo-delete",request,validation.rateLimits.customerMutation))
      return fail("RATE_LIMITED",429)
    const {id}=await context.params
    await deleteOwnedSelfBuildPhoto(session.accountId,id)
    return NextResponse.json({ok:true},{headers:noStore})
  }catch(e){return response(e)}
}
