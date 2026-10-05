import { NextResponse } from "next/server"
import { getCustomerSession } from "../../../../lib/security/customer-session"
import { findCustomerAccountById, listCustomerOrders } from "../../../../lib/server/customer-accounts"
import { getCatalogConfig } from "../../../../lib/server/catalog"
import { bookOrderWithShipway } from "../../../../lib/server/orders"
import { productById } from "../../../../lib/domain/catalog"
import { createPackingVideoViewUrl } from "../../../../lib/server/r2"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getCustomerSession()
    if (!session) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    const account = await findCustomerAccountById(session.accountId)
    if (!account) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

    let [orders, catalogResult] = await Promise.all([listCustomerOrders(account.id), getCatalogConfig()])
    const pendingAutoBooking = orders.find((order) => order.status === "customer_approved" && !order.shippingTrackingNumber)
    if (pendingAutoBooking) {
      try {
        const shipping = await bookOrderWithShipway(pendingAutoBooking.publicId)
        if (!shipping.ok) console.error("customer-orders-auto-book", { publicId: pendingAutoBooking.publicId, code: shipping.code })
        orders = await listCustomerOrders(account.id)
      } catch (error) {
        console.error("customer-orders-auto-book", { publicId: pendingAutoBooking.publicId, error })
      }
    }

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
