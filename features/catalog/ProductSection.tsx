"use client"

import { formatMoney, type CategoryOption, type GiftProduct } from "../../lib/domain/catalog"
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
            <article className="product" key={product.id}>
              <div className="prodTop">
                {product.imageUrl ? <img className="catalogProductImage" src={product.imageUrl} alt={product.name} loading="lazy" /> : <div className="prodIcon" aria-hidden="true">{product.icon || "🎁"}</div>}
                <div className="cat">{product.category}</div>
              </div>
              <h3>{product.name}</h3><p>{product.note}</p><div className="productUnlock">{uiContent.products.from} {formatMoney(product.minTier)}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
