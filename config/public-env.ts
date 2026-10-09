const siteIndexableValue = process.env.NEXT_PUBLIC_SITE_INDEXABLE?.trim().toLowerCase()

export const publicEnv = {
  whatsapp: process.env.NEXT_PUBLIC_CELEBRATION_WHATSAPP?.trim() || "",
  upiId: process.env.NEXT_PUBLIC_CELEBRATION_UPI_ID?.trim() || "",
  upiName: process.env.NEXT_PUBLIC_CELEBRATION_UPI_NAME?.trim() || "",
  supportEmail: process.env.NEXT_PUBLIC_CELEBRATION_SUPPORT_EMAIL?.trim() || "",
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || "",
  siteIndexable: siteIndexableValue ? siteIndexableValue === "true" : process.env.NODE_ENV === "production"
} as const
