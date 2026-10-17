"use client"

import { useEffect, useState } from "react"
import { formatMoney, type CatalogConfig } from "../../../lib/domain/catalog"
import { AdminCatalogManager } from "../AdminCatalogManager"
import { AdminSelfBuildManager } from "../AdminSelfBuildManager"
import { AdminCustomRequests } from "../AdminCustomRequests"
import { AdminSelfBuildPaymentReviews } from "../AdminSelfBuildPaymentReviews"

type HamperTab = "curated" | "occasions" | "selfBuild" | "requests" | "paymentReviews"
const tabs: { id: HamperTab; label: string; subtitle: string }[] = [
  { id: "curated", label: "Curated Hampers", subtitle: "Tiers, prices and box sizes" },
  { id: "occasions", label: "Occasions", subtitle: "Builder defaults" },
  { id: "selfBuild", label: "Self-Build Studio", subtitle: "Private categories and budgets" },
  { id: "requests", label: "Custom Requests", subtitle: "Customer enquiries" },
  { id: "paymentReviews", label: "Payment Reviews", subtitle: "Manual verification only" }
]

/**
 * V3 reorganizes existing versioned admin workflows. Curated+occasions
 * share one published catalog; Self-Build uses its separate versioned
 * config/capacity APIs. No new checkout, payment or stock logic is added.
 */
export function AdminHampersV3({ catalog, onPublished, onDirtyChange }: {
  catalog: CatalogConfig | null
  onPublished: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [tab, setTab] = useState<HamperTab>("curated")
  const [dirty, setDirty] = useState(false)

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function changeTab(next: HamperTab) {
    if (tab === next) return
    if (dirty && !window.confirm("You have unsaved hamper edits. Switching sections will discard them. Continue?")) return
    setDirty(false)
    setTab(next)
  }

  const activeTiers = catalog?.tiers.filter(tier => tier.active !== false) || []
  return <section className="cav3-hampers" aria-label="Hamper management V3">
    <div className="cav3-hamper-hero">
      <div><span className="cav3-eyebrow">Curated + Self-Build · Separate configuration</span>
        <h2>Hamper Studio</h2>
        <p>Manage published curated hampers alongside the disabled-for-customers Self-Build Studio, with existing safeguards.</p>
      </div>
      <div className="cav3-hamper-links">
        <a href="/admin/catalog-preview" target="_blank" rel="noopener noreferrer">Curated preview ↗</a>
        <a href="/admin/self-build-preview" target="_blank" rel="noopener noreferrer">Self-Build preview ↗</a>
      </div>
    </div>
    <div className="cav3-hamper-safety" role="note">
      <strong>Operational separation:</strong> Curated changes use the shared catalog draft/live publish process.
      Self-Build categories and private budgets save independently and never enable buyer checkout.
      Customer Self-Build checkout remains <b>OFF</b>; private per-item costs never appear publicly.
      A saved Self-Build setting is not an individual retail SKU reservation.
    </div>

    <div className="cav3-hamper-overview">
      <div><span>Active curated tiers</span><strong>{catalog ? activeTiers.length : "—"}</strong>
        <small>Published live catalog</small></div>
      <div><span>Occasions</span><strong>{catalog ? catalog.occasions.length : "—"}</strong>
        <small>Published live catalog</small></div>
      <div><span>Self-Build checkout</span><strong className="cav3-hamper-off">Disabled</strong>
        <small>Backend-enforced customer lock</small></div>
    </div>

    {catalog && activeTiers.length > 0 && <section className="cav3-hamper-tier-section">
      <div className="cav3-panel-head"><h2>Live curated hamper tiers</h2><span className="cav3-quiet">Checkout delivery calculated separately</span></div>
      <div className="cav3-hamper-tier-list">{activeTiers.map(tier =>
        <article key={tier.id}><span className="cav3-hamper-tier-name">{tier.name}</span>
          <strong>{formatMoney(tier.price)}</strong>
          <small>{tier.size} · max {tier.maxChoices} items</small></article>)}</div>
      <p className="cav3-hamper-tier-note">These are stored tier prices, not a new checkout quote. Use the existing customer checkout logic for the final payable amount.</p>
    </section>}

    <div className="cav3-hamper-tabs" role="group" aria-label="Hamper management sections">
      {tabs.map(item => <button key={item.id} type="button" onClick={() => changeTab(item.id)}
        aria-pressed={tab === item.id} className={tab === item.id ? "is-active" : ""}>
        <b>{item.label}</b><small>{item.subtitle}</small></button>)}
    </div>

    <div className="cav3-hamper-workspace" key={tab}>
      {tab === "curated" && <AdminCatalogManager section="tiers" reviewGlobalPublish
        onDirtyChange={setDirty} onPublished={onPublished} />}
      {tab === "occasions" && <AdminCatalogManager section="occasions" reviewGlobalPublish
        onDirtyChange={setDirty} onPublished={onPublished} />}
      {tab === "selfBuild" && <AdminSelfBuildManager onDirtyChange={setDirty} />}
      {tab === "requests" && <AdminCustomRequests />}
      {tab === "paymentReviews" && <AdminSelfBuildPaymentReviews />}
    </div>
    <p className="cav3-hamper-footer">
      The existing production admin remains available at <a href="/admin">Current Admin ↗</a>.
      No checkout activation, inventory mapping or Cashfree refund execution has been added to this workspace.
    </p>
  </section>
}
