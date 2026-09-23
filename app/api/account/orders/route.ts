import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { findCustomerAccountById, listCustomerOrders } from "../../../../lib/server/customer-accounts"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { productById } from "../../../../lib/domain/catalog"
import { createPackingVideoViewUrl } from "../../../../lib/server/r2"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    const [orders, catalogResult] = await Promise.all([listCustomerOrders(account.id), getCatalogConfig()])
    const hydrated = await Promise.all(orders.map(async (order) => {
      let packingVideoUrl: string | null = null
      if (order.packingVideoKey) {
        try {
          packingVideoUrl = await createPackingVideoViewUrl(order.packingVideoKey)
        } catch (error) {
          console.error("customer-order-video", error)
        }
      }
      return {
        ...order,
        productNames: order.selectedProductNames.length ? order.selectedProductNames : order.selectedProductIds.map((id) => productById(catalogResult.catalog, id)?.name || id),
        selectedProductNames: undefined,
        packingVideoKey: undefined,
        packingVideoUrl
      }
    }))
    return NextResponse.json({ ok: true, orders: hydrated }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("customer-orders", error)
    return NextResponse.json({ ok: false, error: "ORDER_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
