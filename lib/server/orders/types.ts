import type { OrderStatus } from "../../domain/order-status"

export type OrderRecord = {
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

export type DbOrder = {
  public_id: string
  subtotal_paise: number
  discount_paise: number
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
  issue_type: string | null
  issue_note: string | null
  created_at: Date
  updated_at: Date
}

export function mapOrder(row: DbOrder): OrderRecord {
  return {
    publicId: row.public_id,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
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
    issueType: row.issue_type,
    issueNote: row.issue_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export type TrackingOrderRecord = {
  publicId: string
  subtotalPaise: number
  discountPaise: number
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
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DbTrackingOrder = {
  public_id: string
  subtotal_paise: number
  discount_paise: number
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
  customer_approved_at: Date | null
  created_at: Date
  updated_at: Date
}

export function mapTrackingOrder(row: DbTrackingOrder): TrackingOrderRecord {
  return {
    publicId: row.public_id,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
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
    customerApprovedAt: row.customer_approved_at ? row.customer_approved_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export const TRACKING_ORDER_SELECT = `public_id, subtotal_paise, discount_paise, amount_paise, campaign_title, tier_name, required_date::text, occasion, status, payment_status,
  receiver_name, packing_video_key, shipping_provider, shipping_tracking_number, customer_approved_at, created_at, updated_at`

export const ORDER_SELECT = `public_id, subtotal_paise, discount_paise, amount_paise, campaign_id, campaign_title, tier_name, required_date::text, occasion, status, payment_status, payment_reference,
  customer_name, phone, receiver_name, address, city, state, pincode, gift_message,
  selected_product_ids, selected_product_names, packing_video_key, shipping_provider, shipping_tracking_number, issue_type, issue_note, created_at, updated_at`
