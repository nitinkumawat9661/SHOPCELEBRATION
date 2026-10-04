import type { OrderStatus } from "../../lib/domain/order-status"
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
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  issueType: string | null
  issueNote: string | null
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}
