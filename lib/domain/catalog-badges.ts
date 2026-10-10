import type { GiftProduct } from "./catalog"
import { isIndividualListing, isIndividuallySellable, productDiscountPercent } from "./catalog"

export type ProductBadgeKind = "sold-out" | "bestseller" | "new" | "limited" | "discount"
export type ProductBadge = { kind: ProductBadgeKind; label: string }

const NEW_WINDOW_MS = 21 * 24 * 60 * 60 * 1000

/** Public badge claims require actual SKU evidence. Raw catalog.badge is
 * an operator preference, NOT evidence for newness, bestseller or savings.
 *
 * Bestseller: >=5 real paid+delivered orders AND category leader, attached
 * only by the server-side order-evidence service.
 * New: catalog revision >1 first published within 21 days, server supplied.
 * Limited: opted-in + current real remaining stock of 1–3.
 * Discounts: always computed from the actual current sale price and MRP.
 */
export function productBadge(product: GiftProduct): ProductBadge | null {
  const listed = isIndividualListing(product)
  if (!listed) return null
  if (!isIndividuallySellable(product)) return { kind: "sold-out", label: "Sold out" }

  const signals = product.badgeSignals
  if (signals && Number.isSafeInteger(signals.bestsellerOrders) && signals.bestsellerOrders! >= 5) {
    return { kind: "bestseller", label: "Bestseller" }
  }

  const firstTime = signals?.firstPublishedAt ? Date.parse(signals.firstPublishedAt) : NaN
  if (
    signals && Number.isSafeInteger(signals.firstRevisionVersion) && signals.firstRevisionVersion! > 1 &&
    Number.isFinite(firstTime) && firstTime <= Date.now() &&
    Date.now() - firstTime <= NEW_WINDOW_MS
  ) {
    return { kind: "new", label: "New" }
  }

  if (
    (product.badge || "").trim().toLowerCase() === "limited" &&
    Number.isInteger(product.stockAvailable) &&
    product.stockAvailable! >= 1 && product.stockAvailable! <= 3
  ) {
    return { kind: "limited", label: `Limited · ${product.stockAvailable} left` }
  }

  // Uniform legacy 25% labels came from old template data. They may remain
  // visible as the legal MRP comparison but must not cover every photo.
  const percent = productDiscountPercent(product)
  if (percent !== null && percent !== 25 && percent >= 10 && percent <= 90) {
    return { kind: "discount", label: `${percent}% OFF` }
  }
  return null
}

/** A genuine MRP comparison is always allowed; an extra "Save ₹xx" line
 * should not repeat on every one of the old uniform-25%-markup products. */
export function productSavingLabel(product: GiftProduct): string | null {
  if (!isIndividualListing(product)) return null
  const mrp = product.retail?.mrpPaise
  const sale = product.salePricePaise
  if (!Number.isSafeInteger(mrp) || !Number.isSafeInteger(sale) ||
      mrp! <= sale! || mrp! <= 0) return null
  const percent = productDiscountPercent(product)
  if (percent === null || percent === 25 || percent < 10 || percent > 90) return null
  const rupees = (mrp! - sale!) / 100
  return `Save ₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`
}
