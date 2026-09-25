"use client"

import { useMemo, useState } from "react"
import { categoriesForCatalog, visibleProducts, visibleTiers, type CatalogConfig } from "../../lib/domain/catalog"
import { BudgetSection } from "../catalog/BudgetSection"
import { OccasionRail } from "../catalog/OccasionRail"
import { ProductSection } from "../catalog/ProductSection"
import { AdminPreviewHero } from "./AdminPreviewHero"

export function AdminCatalogPreview({ catalog, liveVersion, isDraft }: { catalog: CatalogConfig; liveVersion: number; isDraft: boolean }) {
  const tiers = useMemo(() => visibleTiers(catalog), [catalog])
  const products = useMemo(() => visibleProducts(catalog), [catalog])
  const categories = useMemo(() => categoriesForCatalog(catalog), [catalog])
  const [tierId, setTierId] = useState(catalog.settings.defaultTierId)
  const [occasion, setOccasion] = useState(catalog.settings.defaultOccasion)
  const [category, setCategory] = useState(catalog.settings.allCategory.id)

  return (
    <main className="adminPreviewPage">
      <div className="adminPreviewBar" role="status">
        <div><b>{isDraft ? "DRAFT PREVIEW" : "LIVE PREVIEW"}</b><span>Public website abhi v{liveVersion} use kar rahi hai. Preview se koi order place nahi hoga.</span></div>
        <a className="secondary" href="/admin">Back to admin</a>
      </div>
      <AdminPreviewHero onBuild={() => document.getElementById("budgets")?.scrollIntoView({ behavior: "smooth" })} tiers={tiers} products={products} />
      <OccasionRail value={occasion} occasions={catalog.occasions} onChange={setOccasion} />
      <BudgetSection tiers={tiers} selectedTierId={tierId} recommendedTierId={catalog.settings.defaultTierId} socialProof={null} onSelect={setTierId} />
      <ProductSection products={products} categories={categories} allCategoryId={catalog.settings.allCategory.id} category={category} onCategory={setCategory} />
      <section><div className="wrap"><div className="adminDraftNotice"><b>Preview only</b> • Checkout, payment aur customer requests intentionally disabled hain.</div></div></section>
    </main>
  )
}
