import type { OrderStatus } from "../../lib/domain/order-status"
import type { CourierPublicStatus } from "../../lib/domain/courier-tracking"
import type { OrderLineItem } from "../../lib/domain/order"

export type TrackedOrder = {
  orderType: "hamper" | "individual"
  lineItems: OrderLineItem[]
  publicId: string
  amountPaise: number
  tierName: string
  requiredDate: string
  occasion: string
  status: OrderStatus
  paymentStatus: string
  receiverName: string
  packingVideoUrl: string | null
  shippingTrackingNumber: string | null
  shippingCourierName?: string | null
  estimatedDeliveryDate?: string | null
  courier?: CourierPublicStatus | null
  courierUnavailable?: boolean
  issueType: string | null
  issueNote: string | null
  customerApprovedAt: string | null
  issueReportDeadline: string | null
  createdAt: string
  updatedAt: string
}
