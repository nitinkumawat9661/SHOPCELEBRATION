// One ₹50 delivery fee for ALL Celebration hampers (curated + Self-Build).
// This is charged on top of the published hamper tier/discounted price.
// Jewelry/individual purchases keep their existing free-delivery logic.
// The Self-Build alias preserves the existing isolated checkout contract.
export const SELF_BUILD_DELIVERY_FEE_PAISE = 5000
export const HAMPER_DELIVERY_FEE_PAISE = SELF_BUILD_DELIVERY_FEE_PAISE

// DISPLAY-ONLY helper. Do not replace the catalog tier price with this value:
// tier eligibility, max choices, 80%/75% internal gift budget and campaign
// discounts MUST keep using the original, pre-delivery tier.price.
export function hamperFinalPriceRupees(originalHamperPriceRupees: number) {
  return originalHamperPriceRupees + HAMPER_DELIVERY_FEE_PAISE / 100
}

