import type { GiftProduct } from "./catalog"
import { isIndividualListing, isIndividuallySellable, productDiscountPercent } from "./catalog"

export type ProductBadgeKind = "sold-out" | "bestseller" | "new" | "limited" | "discount"
export type ProductBadge = { kind: ProductBadgeKind; label: string }

/**
 * Product badges are deliberately conservative.
 * - Old 25% OFF / arbitrary percent labels are never presented as badges.
 * - Discounts always come from the actual saved sale price and MRP.
 * - "New" and "Bestseller" must be explicitly verified and selected in admin.
 * - "Limited" is allowed only when the live stock confirms scarcity.
 * - Some products have no badge. No randomized/artificial rotation.
 */
export function productBadge(product: GiftProduct): ProductBadge | null {
  const listed = isIndividualListing(product)
  if (listed && !isIndividuallySellable(product)) {
    return { kind: "sold-out", label: "Sold out" }
  }

  const requested = (product.badge || "").trim().toLowerCase()
  if (requested === "new") return { kind: "new", label: "New" }
  if (requested === "bestseller" || requested === "best seller") return { kind: "bestseller", label: "Bestseller" }
  if (
    requested === "limited" && listed && Number.isInteger(product.stockAvailable) &&
    product.stockAvailable! >= 1 && product.stockAvailable! <= 3
  ) {
    return { kind: "limited", label: `Limited · ${product.stockAvailable} left` }
  }

  // The common 25% discount remains truthful in the product's MRP/price
  // presentation but is not a badge on every single photograph.
  const percent = listed ? productDiscountPercent(product) : null
  if (percent !== null && percent !== 25 && percent >= 10 && percent <= 90) {
    return { kind: "discount", label: `${percent}% OFF` }
  }
  return null
}

export function productSavingLabel(product: GiftProduct): string | null {
  if (!isIndividualListing(product)) return null
  const mrp = product.retail?.mrpPaise
  const sale = product.salePricePaise
  if (typeof mrp !== "number" || typeof sale !== "number" || mrp <= sale) return null
  const percent = productDiscountPercent(product)
  // Avoid the uniform 25% template-like price copy without hiding the MRP.
  if (percent === 25) {
    const rupees = (mrp - sale) / 100
    return `Save ₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`
  }
  return percent ? `${percent}% OFF` : null
}
