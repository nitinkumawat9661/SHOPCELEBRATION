import { NextResponse } from "next/server"
import { isAdminRequest } from "../../../../../../../lib/security/admin-session"
import { readSelfBuildOrderPhotoForAdmin } from "../../../../../../../lib/server/self-build-order-photos"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
export async function GET(_request:Request, context:{params:Promise<{publicId:string;photoId:string}>}) {
  if(!await isAdminRequest())return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401,headers:privateHeaders})
  try{
    const {publicId,photoId}=await context.params
    const data=await readSelfBuildOrderPhotoForAdmin(publicId,photoId)
    if(!data)return NextResponse.json({ok:false,error:"PHOTO_NOT_FOUND"},{status:404,headers:privateHeaders})
    return new NextResponse(new Uint8Array(data),{headers:{
      ...privateHeaders,"Content-Type":"image/webp",
      "Content-Security-Policy":"default-src 'none'; sandbox",
      "Content-Disposition":"inline"
    }})
  }catch(error){
    // No private R2 object key or byte payload is included in responses.
    console.error("admin-private-order-photo",error instanceof Error?error.message:"ERROR")
    return NextResponse.json({ok:false,error:"PRIVATE_PHOTO_UNAVAILABLE"},{status:503,headers:privateHeaders})
  }
}
