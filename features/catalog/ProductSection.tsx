"use client"

import { catalogImageVariant, formatMoney, primaryProductImage, type CategoryOption, type GiftProduct } from "../../lib/domain/catalog"
import { SafeCatalogImage } from "./SafeCatalogImage"
import { uiContent } from "../../lib/domain/content"

export function ProductSection({ products, categories, allCategoryId, category, onCategory }: {
  products: GiftProduct[]
  categories: CategoryOption[]
  allCategoryId: string
  category: string
  onCategory: (value: string) => void
}) {
  const visible = products.filter((product) => category === allCategoryId || product.category === category)

  return (
    <section className="productsSec" id="products">
      <div className="wrap">
        <div className="centerHead"><div className="kicker">{uiContent.products.kicker}</div><h2>{uiContent.products.title}</h2><p>{uiContent.products.body}</p></div>
        <div className="filters" aria-label="Gift categories">{categories.map((item) => <button type="button" key={item.id} className={`chip ${category === item.id ? "active" : ""}`} aria-pressed={category === item.id} onClick={() => onCategory(item.id)}>{item.label}</button>)}</div>
        <div className="products" aria-live="polite">
          {visible.length === 0 && (
            <div className="catalogEmptyState">
              <b>No gifts in this category right now.</b>
              <p>Try another category, or choose All to see every available option.</p>
            </div>
          )}
          {visible.map((product) => (
            <div className="productReveal" key={product.id}>
              <article className="product">
                <div className="prodTop">
                  {primaryProductImage(product) ? <SafeCatalogImage className="catalogProductImage" src={catalogImageVariant(primaryProductImage(product)!.url, "thumb")} fallbackSrc={primaryProductImage(product)?.fallbackUrl} alt={product.name} /> : <SafeCatalogImage className="catalogProductImage" src="" alt={product.name} />}
                  <div className="cat">{product.category}</div>
                </div>
                <h3>{product.name}</h3><p>{product.note}</p><div className="productUnlock">{uiContent.products.from} {formatMoney(product.minTier)}</div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
