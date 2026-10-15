import type { OrderStatus } from "../../domain/order-status"
import type { OrderLineItem } from "../../domain/order"

export type OrderRecord = {
  orderType: "hamper" | "individual"
  selfBuild?: { selections: { kind: "category" | "option"; id: string; label: string; quantity: number }[]; otherRequestText: string; boxId: string | null; reservationStatus: "reserved" | "committed" | "released" | null }
  lineItems: OrderLineItem[]
  publicId: string
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
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

export type DbOrder = {
  order_type: "hamper" | "individual"
  line_items: OrderLineItem[]
  public_id: string
  subtotal_paise: number
  discount_paise: number
  shipping_paise: number
  amount_paise: number
  campaign_id: string | null
  campaign_title: string | null
  tier_name: string
  required_date: string
  occasion: string
  status: OrderStatus
  payment_status: string
  payment_reference: string
  customer_name: string
  phone: string
  receiver_name: string
  address: string
  city: string
  state: string
  pincode: string
  gift_message: string
  selected_product_ids: string[]
  selected_product_names: string[]
  packing_video_key: string | null
  shipping_provider: string | null
  shipping_tracking_number: string | null
  shipping_carrier_id: string | null
  shipping_label_url: string | null
  shipping_booked_at: Date | null
  issue_type: string | null
  issue_note: string | null
  created_at: Date
  updated_at: Date
}

export function mapOrder(row: DbOrder): OrderRecord {
  return {
    orderType: row.order_type,
    lineItems: row.line_items,
    publicId: row.public_id,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    shippingPaise: row.shipping_paise,
    amountPaise: row.amount_paise,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    tierName: row.tier_name,
    requiredDate: row.required_date,
    occasion: row.occasion,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    customerName: row.customer_name,
    phone: row.phone,
    receiverName: row.receiver_name,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    message: row.gift_message,
    selectedProductIds: row.selected_product_ids,
    selectedProductNames: row.selected_product_names || [],
    packingVideoKey: row.packing_video_key,
    shippingProvider: row.shipping_provider,
    shippingTrackingNumber: row.shipping_tracking_number,
    shippingCarrierId: row.shipping_carrier_id,
    shippingLabelUrl: row.shipping_label_url,
    shippingBookedAt: row.shipping_booked_at ? row.shipping_booked_at.toISOString() : null,
    issueType: row.issue_type,
    issueNote: row.issue_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export type TrackingOrderRecord = {
  orderType: "hamper" | "individual"
  lineItems: OrderLineItem[]
  publicId: string
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  amountPaise: number
  campaignTitle: string | null
  tierName: string
  requiredDate: string
  occasion: string
  status: OrderStatus
  paymentStatus: string
  receiverName: string
  packingVideoKey: string | null
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  issueType: string | null
  issueNote: string | null
  customerApprovedAt: string | null
  issueReportDeadline: string | null
  createdAt: string
  updatedAt: string
}

export type DbTrackingOrder = {
  order_type: "hamper" | "individual"
  line_items: OrderLineItem[]
  public_id: string
  subtotal_paise: number
  discount_paise: number
  shipping_paise: number
  amount_paise: number
  campaign_title: string | null
  tier_name: string
  required_date: string
  occasion: string
  status: OrderStatus
  payment_status: string
  receiver_name: string
  packing_video_key: string | null
  shipping_provider: string | null
  shipping_tracking_number: string | null
  issue_type: string | null
  issue_note: string | null
  customer_approved_at: Date | null
  delivered_at: Date | null
  created_at: Date
  updated_at: Date
}

export function mapTrackingOrder(row: DbTrackingOrder): TrackingOrderRecord {
  return {
    orderType: row.order_type,
    lineItems: row.line_items,
    publicId: row.public_id,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    shippingPaise: row.shipping_paise,
    amountPaise: row.amount_paise,
    campaignTitle: row.campaign_title,
    tierName: row.tier_name,
    requiredDate: row.required_date,
    occasion: row.occasion,
    status: row.status,
    paymentStatus: row.payment_status,
    receiverName: row.receiver_name,
    packingVideoKey: row.packing_video_key,
    shippingProvider: row.shipping_provider,
    shippingTrackingNumber: row.shipping_tracking_number,
    issueType: row.issue_type,
    issueNote: row.issue_note,
    customerApprovedAt: row.customer_approved_at ? row.customer_approved_at.toISOString() : null,
    issueReportDeadline: null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export const TRACKING_ORDER_SELECT = `order_type, line_items, public_id, subtotal_paise, discount_paise, shipping_paise, amount_paise, campaign_title, tier_name, required_date::text, occasion, status, payment_status,
  receiver_name, packing_video_key, shipping_provider, shipping_tracking_number, issue_type, issue_note, customer_approved_at, delivered_at, created_at, updated_at`

export const ORDER_SELECT = `order_type, line_items, public_id, subtotal_paise, discount_paise, shipping_paise, amount_paise, campaign_id, campaign_title, tier_name, required_date::text, occasion, status, payment_status, payment_reference,
  customer_name, phone, receiver_name, address, city, state, pincode, gift_message,
  selected_product_ids, selected_product_names, packing_video_key, shipping_provider, shipping_tracking_number, shipping_carrier_id, shipping_label_url, shipping_booked_at, issue_type, issue_note, created_at, updated_at`
