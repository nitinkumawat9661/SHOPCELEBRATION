"use client"

import { useEffect, useState } from "react"
import { defaultCatalog, formatMoney, type CatalogConfig, type GiftProduct, type Tier } from "../../lib/domain/catalog"

export type CatalogAdminSection = "tiers" | "products" | "occasions"

type AdminCatalogPayload = {
  ok?: boolean
  catalog?: CatalogConfig
  version?: number
  draftExists?: boolean
  draftUpdatedAt?: string | null
  error?: string
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function AdminCatalogManager({ section }: { section: CatalogAdminSection }) {
  const [catalog, setCatalog] = useState<CatalogConfig>(defaultCatalog)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState("")
  const [dirty, setDirty] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function applyPayload(data: AdminCatalogPayload) {
    if (!data.catalog) return
    setCatalog(data.catalog)
    setVersion(data.version || 0)
    setHasDraft(Boolean(data.draftExists))
    setDraftUpdatedAt(data.draftUpdatedAt || null)
    setDirty(false)
  }

  async function load() {
    setError("")
    const response = await fetch("/api/admin/catalog", { cache: "no-store" })
    const data = await response.json() as AdminCatalogPayload
    if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_LOAD_FAILED")
    applyPayload(data)
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "CATALOG_LOAD_FAILED")) }, [])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  function edit(mutator: (current: CatalogConfig) => CatalogConfig) {
    setCatalog(mutator)
    setDirty(true)
    setNotice("")
  }

  function replaceTier(index: number, patch: Partial<Tier>) {
    edit((current) => ({ ...current, tiers: current.tiers.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function replaceProduct(index: number, patch: Partial<GiftProduct>) {
    edit((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function addTier() {
    const price = Math.max(1, (catalog.tiers.at(-1)?.price || 0) + 100)
    edit((current) => ({ ...current, tiers: [...current.tiers, { id: `tier-${Date.now()}`, price, name: "New Hamper", size: "Custom", maxChoices: 3, pointBudget: 6, active: true }] }))
  }

  function duplicateTier(index: number) {
    const source = catalog.tiers[index]
    edit((current) => ({ ...current, tiers: [...current.tiers.slice(0, index + 1), { ...source, id: `${source.id}-copy-${Date.now()}`, name: `${source.name} Copy` }, ...current.tiers.slice(index + 1)] }))
  }

  function addProduct() {
    edit((current) => ({ ...current, products: [...current.products, { id: `item-${Date.now()}`, name: "New Item", category: "Other", minTier: current.tiers[0]?.price || 0, points: 1, note: "", icon: "🎁", active: true }] }))
  }

  function duplicateProduct(index: number) {
    const source = catalog.products[index]
    edit((current) => ({ ...current, products: [...current.products.slice(0, index + 1), { ...source, id: `${source.id}-copy-${Date.now()}`, name: `${source.name} Copy` }, ...current.products.slice(index + 1)] }))
  }

  function addOccasion() {
    edit((current) => ({ ...current, occasions: [...current.occasions, `Occasion ${current.occasions.length + 1}`] }))
  }

  async function uploadImage(file: File, productIndex: number) {
    if (file.size > 5 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE")
    const presignResponse = await fetch("/api/admin/catalog/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type }) })
    const presign = await presignResponse.json() as { ok?: boolean; key?: string; url?: string; error?: string }
    if (!presignResponse.ok || !presign.ok || !presign.key || !presign.url) throw new Error(presign.error || "IMAGE_UPLOAD_FAILED")
    const put = await fetch(presign.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
    if (!put.ok) throw new Error("IMAGE_UPLOAD_FAILED")
    const verifyResponse = await fetch("/api/admin/catalog/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: presign.key }) })
    const verified = await verifyResponse.json() as { ok?: boolean; imageUrl?: string; error?: string }
    if (!verifyResponse.ok || !verified.ok || !verified.imageUrl) throw new Error(verified.error || "IMAGE_VERIFY_FAILED")
    replaceProduct(productIndex, { imageUrl: verified.imageUrl })
  }

  async function saveDraft() {
    setBusy("save")
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalog, version }) })
      const data = await response.json() as AdminCatalogPayload
      if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_DRAFT_SAVE_FAILED")
      applyPayload(data)
      setNotice("Draft saved. Public website unchanged hai.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CATALOG_DRAFT_SAVE_FAILED")
    } finally { setBusy("") }
  }

  async function publishDraft() {
    if (dirty) { setError("SAVE_DRAFT_FIRST"); return }
    if (!hasDraft) return
    if (!window.confirm(`Saved draft ko live v${version + 1} publish karna hai?`)) return
    setBusy("publish")
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/catalog/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) })
      const data = await response.json() as AdminCatalogPayload
      if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_PUBLISH_FAILED")
      applyPayload(data)
      setNotice(`Published successfully. Public website ab v${data.version} use kar rahi hai.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CATALOG_PUBLISH_FAILED")
    } finally { setBusy("") }
  }

  async function discardDraft() {
    if (!hasDraft || !window.confirm("Saved draft discard karke live catalog par wapas jana hai?")) return
    setBusy("discard")
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/catalog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) })
      const data = await response.json() as AdminCatalogPayload
      if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_DRAFT_DISCARD_FAILED")
      applyPayload(data)
      setNotice("Draft discarded. Editor live catalog par reset ho gaya.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CATALOG_DRAFT_DISCARD_FAILED")
    } finally { setBusy("") }
  }

  const title = section === "tiers" ? "Hampers & budgets" : section === "products" ? "Products / objects" : "Occasions & defaults"
  const description = section === "tiers" ? "Budget tiers, box size aur selection limits control karein." : section === "products" ? "Items, images, eligibility, category aur ordering manage karein." : "Occasions aur builder defaults manage karein."

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">CATALOG</div><h2>{title}</h2><p>{description}</p></div>
        <div className="adminActions">
          <button className="secondary" type="button" onClick={() => { if (!dirty || window.confirm("Unsaved edits discard karne hain?")) load().catch((caught) => setError(String(caught))) }}>Reload</button>
          {hasDraft && <a className="secondary" href="/admin/catalog-preview" target="_blank" rel="noreferrer">Preview</a>}
          {hasDraft && <button className="secondary danger" type="button" onClick={discardDraft} disabled={Boolean(busy)}>Discard draft</button>}
          <button className="secondary" type="button" onClick={saveDraft} disabled={Boolean(busy) || !dirty}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button className="primary" type="button" onClick={publishDraft} disabled={Boolean(busy) || dirty || !hasDraft}>{busy === "publish" ? "Publishing…" : `Publish v${version + 1}`}</button>
        </div>
      </div>
      {dirty && <div className="adminDraftNotice"><b>Unsaved edits</b> • Save draft first. Public website v{version} par unchanged hai.</div>}
      {!dirty && hasDraft && <div className="adminDraftNotice"><b>Saved draft ready</b> • Public website abhi v{version} live hai.{draftUpdatedAt ? ` Draft saved ${new Date(draftUpdatedAt).toLocaleString("en-IN")}.` : ""}</div>}
      {!dirty && !hasDraft && <div className="adminDraftNotice"><b>Live catalog v{version}</b> • Edit karke Save draft karein, preview karein, phir publish karein.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}

      {section === "tiers" && <>
        <div className="adminBulkBar"><span>{catalog.tiers.length} hamper tiers</span><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.map((item) => ({ ...item, active: true })) }))}>Activate all</button><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.map((item, index) => ({ ...item, active: item.id === current.settings.defaultTierId || index === 0 })) }))}>Pause non-default</button><button type="button" className="primary" onClick={addTier}>+ Add hamper</button></div>
        <div className="adminEditorList">{catalog.tiers.map((tier, index) => <div className="adminEditorCard adminDraggableCard" draggable key={`${tier.id}-${index}`} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) edit((current) => ({ ...current, tiers: moveItem(current.tiers, dragIndex, index) })); setDragIndex(null) }}>
          <div className="adminCardHandle">⋮⋮ <span>Drag to reorder</span></div>
          <div className="adminEditorGrid">
            <label>ID<input value={tier.id} onChange={(e) => replaceTier(index, { id: slug(e.target.value) })} /></label><label>Name<input value={tier.name} onChange={(e) => replaceTier(index, { name: e.target.value })} /></label><label>Price ₹<input type="number" min={1} value={tier.price} onChange={(e) => replaceTier(index, { price: Number(e.target.value) })} /></label><label>Size<input value={tier.size} onChange={(e) => replaceTier(index, { size: e.target.value })} /></label><label>Max items<input type="number" min={1} value={tier.maxChoices} onChange={(e) => replaceTier(index, { maxChoices: Number(e.target.value) })} /></label><label>Mix points<input type="number" min={1} value={tier.pointBudget} onChange={(e) => replaceTier(index, { pointBudget: Number(e.target.value) })} /></label><label>Badge<input value={tier.label || ""} onChange={(e) => replaceTier(index, { label: e.target.value })} /></label><label className="adminCheck"><input type="checkbox" checked={tier.active !== false} onChange={(e) => replaceTier(index, { active: e.target.checked })} /> Active</label>
          </div>
          <div className="adminEditorActions"><span>{formatMoney(tier.price)}</span><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, tiers: moveItem(current.tiers, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.tiers.length - 1} onClick={() => edit((current) => ({ ...current, tiers: moveItem(current.tiers, index, index + 1) }))}>↓</button><button type="button" className="secondary" onClick={() => duplicateTier(index)}>Duplicate</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.filter((_, i) => i !== index) }))}>Delete</button></div></div>
        </div>)}</div>
      </>}

      {section === "products" && <>
        <div className="adminBulkBar"><span>{catalog.products.length} products / objects</span><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, products: current.products.map((item) => ({ ...item, active: true })) }))}>Activate all</button><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, products: current.products.map((item) => ({ ...item, active: false })) }))}>Pause all</button><button type="button" className="primary" onClick={addProduct}>+ Add product</button></div>
        <div className="adminEditorList">{catalog.products.map((product, index) => <div className="adminEditorCard adminDraggableCard" draggable key={`${product.id}-${index}`} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) edit((current) => ({ ...current, products: moveItem(current.products, dragIndex, index) })); setDragIndex(null) }}>
          <div className="adminCardHandle">⋮⋮ <span>Drag to reorder</span></div>
          <div className="adminEditorGrid"><label>ID<input value={product.id} onChange={(e) => replaceProduct(index, { id: slug(e.target.value) })} /></label><label>Name<input value={product.name} onChange={(e) => replaceProduct(index, { name: e.target.value })} /></label><label>Category<input value={product.category} onChange={(e) => replaceProduct(index, { category: e.target.value })} /></label><label>Available from ₹<input type="number" min={0} value={product.minTier} onChange={(e) => replaceProduct(index, { minTier: Number(e.target.value) })} /></label><label>Points<input type="number" min={1} value={product.points} onChange={(e) => replaceProduct(index, { points: Number(e.target.value) })} /></label><label>Emoji / icon<input value={product.icon || ""} onChange={(e) => replaceProduct(index, { icon: e.target.value })} /></label><label className="adminWide">Description<input value={product.note} onChange={(e) => replaceProduct(index, { note: e.target.value })} /></label><label className="adminWide">Image URL<input value={product.imageUrl || ""} onChange={(e) => replaceProduct(index, { imageUrl: e.target.value })} placeholder="https://… or upload below" /></label><label className="adminWide uploadControl">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file, index).catch((caught) => setError(caught instanceof Error ? caught.message : "IMAGE_UPLOAD_FAILED")) }} /></label><label className="adminCheck"><input type="checkbox" checked={product.active !== false} onChange={(e) => replaceProduct(index, { active: e.target.checked })} /> Active</label></div>
          {product.imageUrl && <img className="adminCatalogPreview" src={product.imageUrl} alt="" />}
          <div className="adminEditorActions"><span>{product.category}</span><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, products: moveItem(current.products, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.products.length - 1} onClick={() => edit((current) => ({ ...current, products: moveItem(current.products, index, index + 1) }))}>↓</button><button type="button" className="secondary" onClick={() => duplicateProduct(index)}>Duplicate</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, products: current.products.filter((_, i) => i !== index) }))}>Delete</button></div></div>
        </div>)}</div>
      </>}

      {section === "occasions" && <>
        <div className="adminEditorGrid adminDefaultsGrid"><label>Default hamper<select value={catalog.settings.defaultTierId} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, defaultTierId: e.target.value } }))}>{catalog.tiers.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Default occasion<select value={catalog.settings.defaultOccasion} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, defaultOccasion: e.target.value } }))}>{catalog.occasions.map((item) => <option key={item}>{item}</option>)}</select></label><label>All-category label<input value={catalog.settings.allCategory.label} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, allCategory: { ...current.settings.allCategory, label: e.target.value } } }))} /></label></div>
        <div className="adminEditorList compact">{catalog.occasions.map((occasion, index) => <div className="adminOccasionRow" key={`${occasion}-${index}`}><input value={occasion} onChange={(e) => edit((current) => ({ ...current, occasions: current.occasions.map((item, i) => i === index ? e.target.value : item) }))} /><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, occasions: moveItem(current.occasions, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.occasions.length - 1} onClick={() => edit((current) => ({ ...current, occasions: moveItem(current.occasions, index, index + 1) }))}>↓</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, occasions: current.occasions.filter((_, i) => i !== index) }))}>Delete</button></div></div>)}</div>
        <button type="button" className="primary" onClick={addOccasion}>+ Add occasion</button>
      </>}
    </section>
  )
}
