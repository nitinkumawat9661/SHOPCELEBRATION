import { NextResponse } from "next/server"
import { validation } from "../../../../../config/validation"
import { getCustomerSession } from "../../../../../lib/security/customer-session"
import { enforceSameOrigin, RequestSecurityError } from "../../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../../lib/server/rate-limit"
import { customerSelfBuildEnabled, SelfBuildDraftError } from "../../../../../lib/server/self-build-drafts"
import { listSelfBuildPhotos,MAX_SELF_BUILD_PHOTO_BYTES,uploadSelfBuildDraftPhoto } from "../../../../../lib/server/self-build-photos"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const privateHeaders={"Cache-Control":"private, no-store"}
function fail(code:string,status:number){return NextResponse.json({ok:false,error:code},{status,headers:privateHeaders})}
function handle(error:unknown){
  if(error instanceof SelfBuildDraftError||error instanceof RequestSecurityError)
    return fail(error.code,error.status)
  console.error("self-build-photos",error)
  return fail("PRIVATE_PHOTO_UNAVAILABLE",503)
}
async function customer(){
  const s=await getCustomerSession()
  if(!s)return {error:"AUTH_REQUIRED",status:401} as const
  if(!await customerSelfBuildEnabled())return {error:"SELF_BUILD_NOT_LIVE",status:403} as const
  return {accountId:s.accountId} as const
}
export async function GET(){
  try{
    const person=await customer()
    if("error" in person)return fail(person.error,person.status)
    return NextResponse.json({ok:true,photos:await listSelfBuildPhotos(person.accountId)},{headers:privateHeaders})
  }catch(e){return handle(e)}
}
export async function POST(request:Request){
  try{
    enforceSameOrigin(request)
    const person=await customer()
    if("error" in person)return fail(person.error,person.status)
    const allowed=await consumeRequestRateLimit("customer-self-build-photo",request,validation.rateLimits.customerMutation)
    if(!allowed)return fail("RATE_LIMITED",429)
    const type=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()||""
    if(!["image/jpeg","image/png","image/webp"].includes(type))return fail("INVALID_PERSONALISED_PHOTO",422)
    const length=request.headers.get("content-length")
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>MAX_SELF_BUILD_PHOTO_BYTES))
      return fail("PHOTO_TOO_LARGE",413)
    if(!request.body)return fail("INVALID_PERSONALISED_PHOTO",422)
    // Streaming strict byte bound, not an unbounded formData()/arrayBuffer().
    const reader=request.body.getReader(),buffers:Uint8Array[]=[]
    let size=0
    try{
      while(true){
        const {value,done}=await reader.read()
        if(done)break
        size+=value.byteLength
        if(size>MAX_SELF_BUILD_PHOTO_BYTES){await reader.cancel();return fail("PHOTO_TOO_LARGE",413)}
        buffers.push(value)
      }
    }finally{reader.releaseLock()}
    if(!size)return fail("INVALID_PERSONALISED_PHOTO",422)
    const bytes=Buffer.concat(buffers.map(b=>Buffer.from(b)),size)
    const photo=await uploadSelfBuildDraftPhoto(person.accountId,bytes,type)
    return NextResponse.json({ok:true,photo},{status:201,headers:privateHeaders})
  }catch(e){return handle(e)}
}
