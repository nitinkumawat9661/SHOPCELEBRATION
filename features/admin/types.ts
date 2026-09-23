import type { OrderStatus } from "../../lib/domain/order-status"

export type AdminOrder = {
  publicId: string
  subtotalPaise: number
  discountPaise: number
  amountPaise: number
  campaignId: string | null
  campaignTitle: string | null
  tierName: string
  requiredDate: string
  occasion: string
  status: OrderStatus
  paymentStatus: string
  paymentReference: string
  customerName: string
  phone: string
  receiverName: string
  address: string
  city: string
  state: string
  pincode: string
  message: string
  selectedProductIds: string[]
  selectedProductNames: string[]
  packingVideoKey: string | null
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  issueType: string | null
  issueNote: string | null
  createdAt: string
  updatedAt: string
}
