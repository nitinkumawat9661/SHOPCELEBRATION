"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type CategoryOption = { value: string; label: string; count: number }

const SORT_OPTIONS = [
  { value: "", label: "Recommended" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name", label: "Name: A–Z" }
]

const PRICE_OPTIONS = [
  { value: "", label: "All prices" },
  { value: "under-120", label: "Under ₹120" },
  { value: "120-149", label: "₹120 – ₹149" },
  { value: "150-179", label: "₹150 – ₹179" },
  { value: "180-plus", label: "₹180 & above" }
]

export function JewelryMarketplaceFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [panel, setPanel] = useState<"sort" | "category" | "price" | null>(null)

  const activeCategory = searchParams.get("category") || ""
  const activeSort = searchParams.get("sort") || ""
  const activePrice = searchParams.get("price") || ""

  const categoryLabel = useMemo(
    () => categories.find((item) => item.value === activeCategory)?.label || "Category",
    [activeCategory, categories]
  )
  const sortLabel = SORT_OPTIONS.find((item) => item.value === activeSort)?.label || "Recommended"
  const priceLabel = PRICE_OPTIONS.find((item) => item.value === activePrice)?.label || "Price"

  function apply(key: "category" | "sort" | "price", value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}#collection` : `${pathname}#collection`)
    setPanel(null)
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    params.delete("sort")
    params.delete("price")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}#collection` : `${pathname}#collection`)
    setPanel(null)
  }

  const activeCount = [activeCategory, activeSort, activePrice].filter(Boolean).length

  return <>
    <div className="marketplaceFilterBar" aria-label="Jewelry filters">
      <button type="button" className={activeSort ? "active" : ""} onClick={() => setPanel("sort")}>
        <span className="marketplaceFilterIcon" aria-hidden="true">⇅</span>
        <span><b>Sort</b><small>{sortLabel}</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      <button type="button" className={activeCategory ? "active" : ""} onClick={() => setPanel("category")}>
        <span className="marketplaceFilterIcon" aria-hidden="true">☰</span>
        <span><b>Category</b><small>{categoryLabel}</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      <button type="button" className={activePrice ? "active" : ""} onClick={() => setPanel("price")}>
        <span className="marketplaceFilterIcon" aria-hidden="true">₹</span>
        <span><b>Price</b><small>{priceLabel}</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      {activeCount > 0 && <button type="button" className="marketplaceFilterClear" onClick={clearAll} aria-label="Clear all filters">
        Clear {activeCount}
      </button>}
    </div>

    {panel && <div className="marketplaceFilterOverlay" role="presentation">
      <button className="marketplaceFilterBackdrop" type="button" aria-label="Close filter" onClick={() => setPanel(null)} />
      <section className="marketplaceFilterSheet" role="dialog" aria-modal="true" aria-label={panel === "sort" ? "Sort products" : panel === "category" ? "Filter by category" : "Filter by price"}>
        <div className="marketplaceFilterSheetHead">
          <div><span>{panel === "sort" ? "Sort products" : panel === "category" ? "Shop by category" : "Choose price range"}</span><small>{panel === "category" ? "Select one jewelry category" : "Choose one option"}</small></div>
          <button type="button" onClick={() => setPanel(null)} aria-label="Close">×</button>
        </div>

        <div className="marketplaceFilterOptions">
          {panel === "sort" && SORT_OPTIONS.map((item) => <button key={item.value || "recommended"} type="button" className={activeSort === item.value ? "selected" : ""} onClick={() => apply("sort", item.value)}><span>{item.label}</span><i aria-hidden="true">{activeSort === item.value ? "✓" : ""}</i></button>)}

          {panel === "category" && <>
            <button type="button" className={!activeCategory ? "selected" : ""} onClick={() => apply("category", "")}><span>All jewelry</span><small>{categories.reduce((sum, item) => sum + item.count, 0)} products</small><i aria-hidden="true">{!activeCategory ? "✓" : ""}</i></button>
            {categories.map((item) => <button key={item.value} type="button" className={activeCategory === item.value ? "selected" : ""} onClick={() => apply("category", item.value)}><span>{item.label}</span><small>{item.count} products</small><i aria-hidden="true">{activeCategory === item.value ? "✓" : ""}</i></button>)}
          </>}

          {panel === "price" && PRICE_OPTIONS.map((item) => <button key={item.value || "all"} type="button" className={activePrice === item.value ? "selected" : ""} onClick={() => apply("price", item.value)}><span>{item.label}</span><i aria-hidden="true">{activePrice === item.value ? "✓" : ""}</i></button>)}
        </div>

        {activeCount > 0 && <button className="marketplaceFilterReset" type="button" onClick={clearAll}>Clear all filters</button>}
      </section>
    </div>}
  </>
}
