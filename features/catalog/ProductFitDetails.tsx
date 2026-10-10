import Link from "next/link"
import type { GiftProduct } from "../../lib/domain/catalog"
import { isJewelryProduct } from "../../lib/domain/catalog-discovery"

/** Fit advice contains no inferred dimensions: the catalog currently has
 * descriptive sizing for some adjustable jewelry but no verified millimetres. */
export function ProductFitDetails({ product }: { product: GiftProduct }) {
  if (!isJewelryProduct(product)) return null

  const fitCopy = [product.description || "", ...(product.highlights || [])].join(" ").toLowerCase()
  const adjustable = /\badjustable\b|\bfree[- ]size\b/.test(fitCopy)
  const category = product.category.toLowerCase()
  const isRing = /\brings?\b/.test(category)
  const isWristwear = /\bbangles?\b|\bbracelets?\b|\bcuffs?\b/.test(category)
  const item = isRing ? "ring" : isWristwear ? "bracelet or bangle" : "jewelry"

  return (
    <section className="productFitDetails" aria-label="Fit and measurements">
      <h2>Fit &amp; measurements</h2>
      {adjustable ? (
        <p>This {item} is described as adjustable in its product details. Fit can still vary from person to person, so please confirm your preferred measurement before ordering.</p>
      ) : (
        <p>Exact measurements for this piece are not listed yet. Please confirm the size or length with Celebration before ordering if fit matters to you.</p>
      )}
      <p className="productFitCaution">We don’t publish estimated ring diameters, wrist circumferences or chain lengths as product measurements.</p>
      <Link href="/faq">Read the sizing FAQ <span aria-hidden="true">→</span></Link>
    </section>
  )
}
