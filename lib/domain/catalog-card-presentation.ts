import type { GiftProduct } from "./catalog"

/**
 * Visual presentation ONLY. A stable grouping of the product ID creates
 * understated framing variety, not a claim about the image's viewpoint.
 * Never infer "on model", "product-only" or other photo facts from a name.
 */
export type CatalogCardTreatment = "paper" | "clean" | "folio"

export function catalogCardTreatment(product: Pick<GiftProduct, "id">): CatalogCardTreatment {
  const digits = product.id.match(/-(\d+)$/)?.[1]
  if (digits) {
    const remainder = Number.parseInt(digits, 10) % 3
    return remainder === 0 ? "folio" : remainder === 1 ? "clean" : "paper"
  }
  // A stable, non-random fallback for user-added IDs without numeric suffixes.
  const score = [...product.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 3
  return score === 0 ? "folio" : score === 1 ? "clean" : "paper"
}
