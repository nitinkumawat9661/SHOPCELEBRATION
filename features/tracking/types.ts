import type { OrderStatus } from "../../lib/domain/order-status"

export type TrackedOrder = {
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
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}
