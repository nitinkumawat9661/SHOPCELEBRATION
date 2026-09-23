export type CampaignTrigger = "checkout" | "hesitation"
export type CampaignAudience = "all" | "first_order"
export type CampaignDiscountType = "percent" | "fixed"

export type Campaign = {
  id: string
  name: string
  badge: string
  message: string
  active: boolean
  trigger: CampaignTrigger
  audience: CampaignAudience
  discountType: CampaignDiscountType
  discountValue: number
  maxDiscountRupees: number
  minSubtotalRupees: number
  eligibleTierIds: string[]
  eligibleProductIds: string[]
  startAt: string
  endAt: string
  totalLimit: number
  perCustomerLimit: number
}

export type CampaignConfig = {
  campaigns: Campaign[]
}

export type OfferQuote = {
  id: string
  campaignId: string
  campaignTitle: string
  badge: string
  message: string
  trigger: CampaignTrigger
  subtotalPaise: number
  discountPaise: number
  payablePaise: number
  expiresAt: string
}

export const emptyCampaignConfig: CampaignConfig = { campaigns: [] }
