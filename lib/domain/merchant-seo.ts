/**
 * Public, truthful Google merchant metadata for Celebration retail jewellery.
 * Source of truth for price/stock remains the live catalog, NOT this file.
 *
 * Business-confirmed 17 Oct 2026:
 * - Free standard delivery for individually sold jewellery (checkout-verified).
 * - Maximum 2 days to dispatch; overall typical order-to-door 3–7 days.
 * Transit split is NOT independently verified and is deliberately omitted.
 * - Return conditions are published at /policies. There is no universal
 *   voluntary-return window; do NOT invent merchantReturnDays.
 */
export const CELEBRATION_SITE_URL = "https://shopcelebration.in"
export const CELEBRATION_ORGANIZATION_ID = `${CELEBRATION_SITE_URL}/#organization`
export const CELEBRATION_RETURN_POLICY_URL = `${CELEBRATION_SITE_URL}/policies`
export const CELEBRATION_RETURN_POLICY_ID = `${CELEBRATION_RETURN_POLICY_URL}#merchant-returns`

export function celebrationOrganizationMarkup() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": CELEBRATION_ORGANIZATION_ID,
    name: "Celebration",
    url: CELEBRATION_SITE_URL,
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      "@id": CELEBRATION_RETURN_POLICY_ID,
      // Google's organization-level Option B accepts a policy URL alone.
      merchantReturnLink: CELEBRATION_RETURN_POLICY_URL
    }
  }
}

export function celebrationOfferShippingDetails() {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "INR" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 2, unitCode: "DAY" }
      // No transitTime: 3–7 days is total order-to-door, NOT transit only.
    }
  }
}

export function celebrationReturnPolicyReference() {
  return { "@id": CELEBRATION_RETURN_POLICY_ID }
}
