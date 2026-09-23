export const publicEnv = {
  whatsapp: process.env.NEXT_PUBLIC_CELEBRATION_WHATSAPP?.trim() || "",
  upiId: process.env.NEXT_PUBLIC_CELEBRATION_UPI_ID?.trim() || "",
  upiName: process.env.NEXT_PUBLIC_CELEBRATION_UPI_NAME?.trim() || "",
  supportEmail: process.env.NEXT_PUBLIC_CELEBRATION_SUPPORT_EMAIL?.trim() || "",
  siteIndexable: process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true"
} as const
