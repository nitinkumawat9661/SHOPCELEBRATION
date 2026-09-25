"use client"

import { type CSSProperties, useEffect, useRef } from "react"
import { formatMoney, type CategoryOption, type GiftProduct } from "../../lib/domain/catalog"
import { uiContent } from "../../lib/domain/content"
import { Reveal } from "../motion/Reveal"

export function ProductSection({ products, categories, allCategoryId, category, onCategory }: {
  products: GiftProduct[]
  categories: CategoryOption[]
  allCategoryId: string
  category: string
  onCategory: (value: string) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const visible = products.filter((product) => category === allCategoryId || product.category === category)

  useEffect(() => {
    const root = gridRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-product-reveal]"))
    if (nodes.length === 0) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      nodes.forEach((node) => { node.dataset.visible = "true" })
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const node = entry.target as HTMLElement
        node.dataset.visible = "true"
        observer.unobserve(node)
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" })

    nodes.forEach((node) => {
      node.dataset.visible = "false"
      observer.observe(node)
    })
    return () => observer.disconnect()
  }, [category, visible.length])

  return (
    <section className="productsSec" id="products">
      <div className="wrap">
        <Reveal><div className="centerHead"><div className="kicker">{uiContent.products.kicker}</div><h2>{uiContent.products.title}</h2><p>{uiContent.products.body}</p></div></Reveal>
        <div className="filters" aria-label="Gift categories">{categories.map((item) => <button type="button" key={item.id} className={`chip ${category === item.id ? "active" : ""}`} aria-pressed={category === item.id} onClick={() => onCategory(item.id)}>{item.label}</button>)}</div>
        <div ref={gridRef} className="products" aria-live="polite">
          {visible.length === 0 && (
            <div className="catalogEmptyState">
              <b>No gifts in this category right now.</b>
              <p>Try another category, or choose All to see every available option.</p>
            </div>
          )}
          {visible.map((product, index) => (
            <div
              className="motionReveal productReveal"
              data-product-reveal
              data-visible="false"
              style={{ "--reveal-delay": `${Math.min(index, 7) * 45}ms` } as CSSProperties}
              key={product.id}
            >
              <article className="product">
                <div className="prodTop">
                  {product.imageUrl ? <img className="catalogProductImage" src={product.imageUrl} alt={product.name} loading="lazy" /> : <div className="prodIcon" aria-hidden="true">{product.icon || "🎁"}</div>}
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
