import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../../lib/security/admin-session"
import { listSelfBuildOrderPhotosForAdmin } from "../../../../../../lib/server/self-build-order-photos"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const privateHeaders={"Cache-Control":"private, no-store"}
export async function GET(_request:Request, context:{params:Promise<{publicId:string}>}) {
  if(!await isAdminRequest())return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401,headers:privateHeaders})
  try{
    const {publicId}=await context.params
    const photos=await listSelfBuildOrderPhotosForAdmin(publicId)
    if(photos===null)return NextResponse.json({ok:false,error:"NOT_FOUND"},{status:404,headers:privateHeaders})
    return NextResponse.json({ok:true,photos},{headers:privateHeaders})
  }catch(error){
    console.error("admin-private-order-photos-unavailable")
    return NextResponse.json({ok:false,error:"PRIVATE_PHOTOS_UNAVAILABLE"},{status:503,headers:privateHeaders})
  }
}
