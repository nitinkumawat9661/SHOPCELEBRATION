import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { enforceSameOrigin, readJsonBody, RequestSecurityError } from "../../../../lib/security/request"
import { consumeRequestRateLimit } from "../../../../lib/server/rate-limit"
import { validation } from "../../../../config/validation"
import { addWishlistProducts, listAccountWishlist, setWishlistProduct, WishlistError } from "../../../../lib/server/customer-wishlist"

export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store" }

async function account() {
  const session = await getCustomerSession()
  return session?.accountId || null
}

export async function GET() {
  try {
    const id = await account()
    if (!id) return NextResponse.json({ ok:false, error:"AUTH_REQUIRED" }, { status:401,headers:noStore })
    return NextResponse.json({ ok:true, productIds: await listAccountWishlist(id) }, { headers:noStore })
  } catch (error) {
    console.error("customer-wishlist-read",error)
    return NextResponse.json({ ok:false,error:"WISHLIST_UNAVAILABLE" },{status:503,headers:noStore})
  }
}

async function change(request: Request, action: "PUT" | "POST") {
  try {
    enforceSameOrigin(request)
    const id = await account()
    if (!id) return NextResponse.json({ ok:false,error:"AUTH_REQUIRED" },{status:401,headers:noStore})
    const allowed = await consumeRequestRateLimit("customer-wishlist",request,validation.rateLimits.customerMutation)
    if (!allowed) return NextResponse.json({ok:false,error:"RATE_LIMITED"},{status:429,headers:noStore})
    if (action === "POST") {
      const body = await readJsonBody<{ productIds?: unknown }>(request)
      return NextResponse.json({ok:true,productIds:await addWishlistProducts(id,body.productIds)},{headers:noStore})
    }
    const body = await readJsonBody<{productId?: unknown;saved?: unknown}>(request)
    return NextResponse.json({ok:true,productIds:await setWishlistProduct(id,body.productId,body.saved)},{headers:noStore})
  } catch (error) {
    if (error instanceof RequestSecurityError || error instanceof WishlistError)
      return NextResponse.json({ok:false,error:error.code},{status:error.status,headers:noStore})
    console.error("customer-wishlist-write",error)
    return NextResponse.json({ok:false,error:"WISHLIST_UNAVAILABLE"},{status:503,headers:noStore})
  }
}
export async function POST(request:Request){return change(request,"POST")}
export async function PUT(request:Request){return change(request,"PUT")}
