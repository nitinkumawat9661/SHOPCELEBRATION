import type { OrderStatus } from "../../lib/domain/order-status"
import type { OrderLineItem } from "../../lib/domain/order"

export type AdminOrder = {
  orderType: "hamper" | "individual"
  selfBuild?: { selections: { kind: "category" | "option"; id: string; label: string; quantity: number }[]; otherRequestText: string; boxId: string | null; reservationStatus: "reserved" | "committed" | "released" | null }
  lineItems: OrderLineItem[]
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
  shippingCarrierId: string | null
  shippingLabelUrl: string | null
  shippingBookedAt: string | null
  issueType: string | null
  issueNote: string | null
  createdAt: string
  updatedAt: string
}
