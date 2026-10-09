import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { findCustomerAccountById, listCustomerOrders } from "../../../../lib/server/customer-accounts"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { productById } from "../../../../lib/domain/catalog"
import { createPackingVideoViewUrl } from "../../../../lib/server/r2"
import { getShipwayTracking } from "../../../../lib/server/shipway"

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
      let estimatedDeliveryDate: string | null = null
      if (order.shippingProvider === "Shipway" && order.shippingTrackingNumber && !["cancelled", "delivered", "issue_reported", "refund_or_replacement_resolved"].includes(order.status)) {
        try {
          estimatedDeliveryDate = (await getShipwayTracking(order.shippingTrackingNumber))?.estimatedDeliveryDate || null
        } catch (error) {
          console.error("customer-order-edd", error)
        }
      }
      if (order.packingVideoKey) {
        try {
          packingVideoUrl = await createPackingVideoViewUrl(order.packingVideoKey)
        } catch (error) {
          console.error("customer-order-video", error)
        }
      }
      return {
        orderType: order.orderType,
        lineItems: order.lineItems,
        publicId: order.publicId,
        amountPaise: order.amountPaise,
        tierName: order.tierName,
        productNames: order.selectedProductNames.length ? order.selectedProductNames : order.selectedProductIds.map((id) => productById(catalogResult.catalog, id)?.name || "Gift item"),
        requiredDate: order.requiredDate,
        occasion: order.occasion,
        status: order.status,
        paymentStatus: order.paymentStatus,
        receiverName: order.receiverName,
        packingVideoUrl,
        shippingTrackingNumber: order.shippingTrackingNumber,
        estimatedDeliveryDate,
        customerApprovedAt: order.customerApprovedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    }))
    return NextResponse.json({ ok: true, orders: hydrated }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("customer-orders", error)
    return NextResponse.json({ ok: false, error: "ORDER_SERVICE_UNAVAILABLE" }, { status: 503 })
  }
}
