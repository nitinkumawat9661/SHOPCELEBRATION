"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { SelfBuildAdminState, SelfBuildCategory, SelfBuildOption } from "../../lib/server/self-build-admin"
import "../../styles/admin-self-build-20261013.css"

type Kind = SelfBuildCategory["selectionKind"]
type Notice = { tone: "good" | "error"; message: string }
const money = (paise: number | null) => (paise === null ? "" : String(paise / 100))
const toPaise = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : 0
}
const sortByOrder = <T extends { displayOrder: number; label: string }>(items: T[]) =>
  [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
const initialKinds: { value: Kind; label: string }[] = [
  { value: "category", label: "Category with quantity" },
  { value: "group", label: "Folder of subcategories" },
  { value: "variant", label: "Category with size choices" },
  { value: "photo", label: "Personalised photos" }
]
function freshId(name: string, reserved: string[]) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || "category"
  let id = slug, sequence = 2
  while (reserved.includes(id)) id = `${slug.slice(0, 48)}-${sequence++}`
  return id
}
function availabilitySummary(confirmed: boolean, units: number | null) {
  return confirmed ? `Confirmed capacity: ${units ?? 0} unit(s)` : "Availability not confirmed"
}

function CapacityControls({ confirmed, units, onChange, disabled = false }: {
  confirmed: boolean
  units: number | null
  disabled?: boolean
  onChange: (confirmed: boolean, units: number | null) => void
}) {
  return <div className="sbAdminCapacity">
    <label className="sbAdminCheck">
      <input type="checkbox" disabled={disabled} checked={confirmed} onChange={e => onChange(e.target.checked, e.target.checked ? (units ?? 0) : null)} />
      Verified capacity
    </label>
    <label className="sbAdminCapacityCount">Available units
      <input type="number" inputMode="numeric" min="0" max="1000000" step="1" disabled={disabled || !confirmed}
        value={confirmed ? units ?? 0 : ""} placeholder="Not confirmed"
        onChange={e => onChange(true, Math.max(0, Math.trunc(Number(e.target.value) || 0)))} />
    </label>
    <small>Planning units only; orders do not reserve/decrement these yet.</small>
  </div>
}

function OptionRow({ option, count, move, patch, remove, busy }: {
  option: SelfBuildOption
  count: number
  move: (delta: -1 | 1) => void
  patch: (changes: Partial<SelfBuildOption>) => void
  remove: () => void
  busy: boolean
}) {
  return <div className="sbAdminOptionRow" data-option-id={option.id}>
    <div className="sbAdminOptionTop">
      <div className="sbAdminTitle"><strong>{option.label}</strong><span>Size / pack option</span></div>
      <div className="sbAdminRowActions">
        <button type="button" disabled={busy || count < 2} onClick={() => move(-1)} aria-label={`Move ${option.label} earlier`}>↑</button>
        <button type="button" disabled={busy || count < 2} onClick={() => move(1)} aria-label={`Move ${option.label} later`}>↓</button>
        <button type="button" disabled={busy} onClick={remove} className="sbAdminDanger">Remove</button>
      </div>
    </div>
    <div className="sbAdminFields">
      <label>Option name<input maxLength={100} disabled={busy} value={option.label} onChange={e => patch({ label: e.target.value })} /></label>
      <label>Private budget / selection (₹)<input aria-label={`${option.label} internal budget`} type="number" min="0" max="21474836" step="0.01" disabled={busy}
        value={money(option.unitBudgetPaise)} onChange={e => patch({ unitBudgetPaise: toPaise(e.target.value) })} /></label>
      <label className="sbAdminCheck sbAdminToggle"><input type="checkbox" checked={option.active} disabled={busy} onChange={e => patch({ active: e.target.checked })} /> Active in preview</label>
    </div>
    <CapacityControls confirmed={option.availabilityConfirmed} units={option.availableUnits} disabled={busy}
      onChange={(availabilityConfirmed, availableUnits) => patch({ availabilityConfirmed, availableUnits })} />
  </div>
}

function CategoryRow({ category, siblings, allCategories, options, busy, patch, patchOption, addOption, removeOption, moveOption, removeCategory, moveCategory }: {
  category: SelfBuildCategory
  siblings: SelfBuildCategory[]
  allCategories: SelfBuildCategory[]
  options: SelfBuildOption[]
  busy: boolean
  patch: (changes: Partial<SelfBuildCategory>) => void
  patchOption: (id: string, changes: Partial<SelfBuildOption>) => void
  addOption: () => void
  removeOption: (id: string) => void
  moveOption: (id: string, delta: -1 | 1) => void
  removeCategory: () => void
  moveCategory: (delta: -1 | 1) => void
}) {
  const supportsUnitBudget = category.selectionKind === "category" || category.selectionKind === "photo"
  const isQuantity = category.selectionKind === "category" || category.selectionKind === "photo"
  const childGroups = allCategories.filter(x => x.selectionKind === "group" && x.id !== category.id)
  const descendants = (potentialParentId: string) => {
    const seen = new Set([category.id])
    let cursor: string | null = potentialParentId
    while (cursor) {
      if (seen.has(cursor)) return true
      seen.add(cursor)
      cursor = allCategories.find(x => x.id === cursor)?.parentId ?? null
    }
    return false
  }
  const siblingsSorted = sortByOrder(siblings)
  const index = siblingsSorted.findIndex(x => x.id === category.id)
  const availableGroupParents = childGroups.filter(x => !descendants(x.id))

  return <article className="sbAdminCategory" data-category-id={category.id}>
    <div className="sbAdminCategoryHead">
      <div className="sbAdminTitle"><strong>{category.label || "New category"}</strong><span>{category.selectionKind.replaceAll("_", " ")} · {category.id}</span></div>
      <div className="sbAdminRowActions">
        <button type="button" disabled={busy || index === 0} onClick={() => moveCategory(-1)} aria-label={`Move ${category.label} earlier`}>↑</button>
        <button type="button" disabled={busy || index < 0 || index === siblingsSorted.length - 1} onClick={() => moveCategory(1)} aria-label={`Move ${category.label} later`}>↓</button>
        <button type="button" className="sbAdminDanger" disabled={busy} onClick={removeCategory}>Remove</button>
      </div>
    </div>
    <div className="sbAdminFields">
      <label>Visible category label
        <input maxLength={100} disabled={busy} value={category.label} onChange={e => patch({ label: e.target.value })} />
      </label>
      <label>Show inside
        <select disabled={busy} value={category.parentId ?? ""} onChange={e => patch({ parentId: e.target.value || null })}>
          <option value="">Top-level categories</option>
          {availableGroupParents.map(parent => <option key={parent.id} value={parent.id}>{parent.label}</option>)}
        </select>
      </label>
      {supportsUnitBudget && <label>Private budget per {category.selectionKind === "photo" ? "photo" : "unit"} (₹)
        <input type="number" min="0" max="21474836" step="0.01" disabled={busy} value={money(category.unitBudgetPaise)}
          onChange={e => patch({ unitBudgetPaise: toPaise(e.target.value) })} />
      </label>}
      <label className="sbAdminCheck sbAdminToggle"><input type="checkbox" disabled={busy} checked={category.active} onChange={e => patch({ active: e.target.checked })} /> Active in design preview</label>
      {category.selectionKind === "photo" && <label>Photo budget charging
        <select disabled={busy} value={category.chargeMode} onChange={e => patch({ chargeMode: e.target.value as SelfBuildCategory["chargeMode"] })}>
          <option value="per_unit">Every photo × quantity (approved)</option>
          <option value="once_per_category">Once per photo category (changes the rule)</option>
        </select>
      </label>}
    </div>
    {isQuantity && <CapacityControls confirmed={category.availabilityConfirmed} units={category.availableUnits} disabled={busy}
      onChange={(availabilityConfirmed, availableUnits) => patch({ availabilityConfirmed, availableUnits })} />}
    {category.selectionKind === "variant" && <div className="sbAdminOptionsBlock">
      <div className="sbAdminOptionHeading"><div><b>Pack / size options</b><span>Quantity, internal budget and capacity are independent per size.</span></div>
        <button type="button" disabled={busy} onClick={addOption}>+ Add size</button></div>
      {options.length ? <div className="sbAdminOptionsList">{sortByOrder(options).map(option =>
        <OptionRow key={option.id} option={option} count={options.length} busy={busy}
          patch={changes => patchOption(option.id, changes)}
          move={delta => moveOption(option.id, delta)}
          remove={() => removeOption(option.id)} />)}</div>
        : <p className="sbAdminEmpty">No size choices yet. Add at least one option, or leave this category inactive.</p>}
    </div>}
    {!isQuantity && category.selectionKind !== "variant" && category.selectionKind !== "group" && <p className="sbAdminHint">Only the team-discussion text is collected for this category; no charge.</p>}
  </article>
}

export function AdminSelfBuildManager() {
  const [state, setState] = useState<SelfBuildAdminState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [newName, setNewName] = useState("")
  const [newKind, setNewKind] = useState<Kind>("category")
  const [newParent, setNewParent] = useState("")
  const [tab, setTab] = useState<"categories" | "configuration">("categories")
  const categories = state?.categories ?? []
  const options = state?.options ?? []
  const topLevel = useMemo(() => sortByOrder(categories.filter(x => !x.parentId)), [categories])
  const groups = useMemo(() => sortByOrder(categories.filter(x => x.selectionKind === "group")), [categories])

  async function load(confirmDiscard = false) {
    if (confirmDiscard && dirty && !window.confirm("Discard your unsaved Self-Build changes and reload saved settings?")) return
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/admin/self-build", { credentials: "same-origin", cache: "no-store" })
      const data = await response.json() as SelfBuildAdminState & { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "SELF_BUILD_SETTINGS_LOAD_FAILED")
      setState({ version: data.version, config: data.config, categories: data.categories, options: data.options })
      setDirty(false)
    } catch (cause) {
      setNotice({ tone: "error", message: cause instanceof Error ? cause.message : "Settings unavailable. Retry." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function edit(change: (previous: SelfBuildAdminState) => SelfBuildAdminState) {
    if (!state || busy) return
    setState(previous => previous ? change(previous) : previous)
    setDirty(true)
    setNotice(null)
  }
  function patchCategory(id: string, changes: Partial<SelfBuildCategory>) {
    edit(s => ({ ...s, categories: s.categories.map(c => c.id === id ? { ...c, ...changes } : c) }))
  }
  function patchOption(id: string, changes: Partial<SelfBuildOption>) {
    edit(s => ({ ...s, options: s.options.map(o => o.id === id ? { ...o, ...changes } : o) }))
  }
  function moveCategory(id: string, delta: -1 | 1) {
    if (!state) return
    const current = state.categories.find(c => c.id === id)
    if (!current) return
    const siblings = sortByOrder(state.categories.filter(c => c.parentId === current.parentId))
    const index = siblings.findIndex(x => x.id === id), swap = index + delta
    if (swap < 0 || swap >= siblings.length) return
    const reordered = [...siblings]
    ;[reordered[index], reordered[swap]] = [reordered[swap], reordered[index]]
    const order = new Map(reordered.map((c, i) => [c.id, (i + 1) * 10]))
    edit(s => ({ ...s, categories: s.categories.map(c => order.has(c.id) ? { ...c, displayOrder: order.get(c.id)! } : c) }))
  }
  function moveOption(id: string, delta: -1 | 1) {
    if (!state) return
    const option = state.options.find(o => o.id === id)
    if (!option) return
    const siblings = sortByOrder(state.options.filter(o => o.categoryId === option.categoryId))
    const index = siblings.findIndex(x => x.id === id), swap = index + delta
    if (swap < 0 || swap >= siblings.length) return
    const reordered = [...siblings]
    ;[reordered[index], reordered[swap]] = [reordered[swap], reordered[index]]
    const order = new Map(reordered.map((o, i) => [o.id, (i + 1) * 10]))
    edit(s => ({ ...s, options: s.options.map(o => order.has(o.id) ? { ...o, displayOrder: order.get(o.id)! } : o) }))
  }
  function addCategory() {
    const label = newName.trim()
    if (!label || !state) { setNotice({ tone: "error", message: "Enter a category label first." }); return }
    const id = freshId(label, state.categories.map(c => c.id))
    const siblings = state.categories.filter(c => c.parentId === (newParent || null))
    const max = Math.max(0, ...siblings.map(c => c.displayOrder))
    const unitBudgetPaise = newKind === "photo" || newKind === "category" ? 0 : null
    const chargeMode: SelfBuildCategory["chargeMode"] = newKind === "group" ? "none" : newKind === "variant" ? "option" : "per_unit"
    const category: SelfBuildCategory = { id, label, parentId: newParent || null, selectionKind: newKind,
      chargeMode, unitBudgetPaise, displayOrder: max + 10, active: false, availabilityConfirmed: false, availableUnits: null }
    edit(s => ({ ...s, categories: [...s.categories, category] }))
    setNewName("")
    setNotice({ tone: "good", message: "Draft category added in inactive mode. Set its budget and availability, then Publish." })
  }
  function removeCategory(id: string) {
    if (!state) return
    const target = state.categories.find(c => c.id === id)
    if (!target) return
    const descendants = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const c of state.categories) if (c.parentId && descendants.has(c.parentId) && !descendants.has(c.id)) {
        descendants.add(c.id);changed = true
      }
    }
    if (!window.confirm(`Remove "${target.label}" and ${descendants.size - 1} nested categories, including their size choices? This becomes permanent when Published. You can disable it instead.`)) return
    edit(s => ({
      ...s, categories: s.categories.filter(c => !descendants.has(c.id)),
      options: s.options.filter(o => !descendants.has(o.categoryId))
    }))
  }
  function addOption(categoryId: string) {
    if (!state) return
    const siblings = state.options.filter(o => o.categoryId === categoryId)
    const id = freshId(`${categoryId}-new-size`, state.options.map(o => o.id))
    const option: SelfBuildOption = {
      id, categoryId, label: "New size", unitBudgetPaise: 0,
      displayOrder: Math.max(0, ...siblings.map(o => o.displayOrder)) + 10,
      active: false, availabilityConfirmed: false, availableUnits: null
    }
    edit(s => ({ ...s, options: [...s.options, option] }))
  }
  function removeOption(id: string) {
    const option = state?.options.find(x => x.id === id)
    if (!option || !window.confirm(`Remove "${option.label}"? It will be deleted from configuration when Published.`)) return
    edit(s => ({ ...s, options: s.options.filter(x => x.id !== id) }))
  }
  async function publish() {
    if (!state || !dirty || busy) return
    setBusy(true);setNotice(null)
    try {
      const response = await fetch("/api/admin/self-build", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      })
      const data = await response.json() as SelfBuildAdminState & { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        if (response.status === 409) throw new Error("STALE_SELF_BUILD_CONFIGURATION: Another change was saved. Copy any important edits, then reload the latest version.")
        throw new Error(data.error || "SELF_BUILD_SETTINGS_SAVE_FAILED")
      }
      setState({ version: data.version, config: data.config, categories: data.categories, options: data.options })
      setDirty(false)
      setNotice({ tone: "good", message: `Category-only Self-Build settings saved as version ${data.version}. Buyer checkout remains locked OFF.` })
    } catch (cause) {
      setNotice({ tone: "error", message: cause instanceof Error ? cause.message : "Save failed. No changes were published." })
    } finally {
      setBusy(false)
    }
  }

  return <section className="sbAdminRoot adminWorkspaceCard" aria-label="Self-build hamper admin manager">
    <div className="sbAdminHeading">
      <div><span className="sbAdminEyebrow">GIFT ATELIER / CATEGORY BUILDER</span><h2>Self-Build Hampers</h2>
        <p>Edit customer category labels, private budget consumption, pack sizes and confirmed category-level fulfilment capacity. <strong>No SKU mapping.</strong></p></div>
      <div className="sbAdminHeadingActions">
        <Link className="sbAdminOutline" href="/admin/self-build-preview" target="_blank" rel="noopener noreferrer">View minimalist preview ↗</Link>
        <button type="button" className="sbAdminOutline" disabled={busy || loading} onClick={() => void load(true)}>Reload</button>
        <button type="button" className="sbAdminPublish" disabled={!dirty || busy || loading} onClick={() => void publish()}>{busy ? "Saving…" : `Publish changes${state ? ` · v${state.version + 1}` : ""}`}</button>
      </div>
    </div>
    <div className="sbAdminSafety"><span aria-hidden="true">●</span><div><b>Buyer ordering: LOCKED OFF</b><p>Prices here are private internal hamper budget amounts, never retail product prices. Confirmed availability is planning data only; no live stock reservation or checkout is enabled.</p></div></div>
    {dirty && <div className="sbAdminDirty" role="status">Unsaved changes · Preview still uses the last saved database version. Publish to update it.</div>}
    {notice && <div role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "sbAdminAlert sbAdminAlert--error" : "sbAdminAlert sbAdminAlert--good"}>{notice.message}</div>}
    {loading && <p className="sbAdminLoading" role="status">Loading category settings from the database…</p>}
    {!loading && !state && <button type="button" className="sbAdminPublish" onClick={() => void load()}>Retry loading settings</button>}
    {state && <div className="sbAdminContent">
      <div className="sbAdminStats">
        <div><b>{state.categories.length}</b><span>Category records</span></div>
        <div><b>{state.options.length}</b><span>Pack sizes</span></div>
        <div><b>{state.categories.filter(x => x.availabilityConfirmed).length + state.options.filter(x => x.availabilityConfirmed).length}</b><span>Capacity entries verified</span></div>
        <div><b>v{state.version}</b><span>Saved revision</span></div>
      </div>
      <nav className="sbAdminTabs" aria-label="Self-build settings sections">
        <button type="button" className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}>Categories & pack sizes</button>
        <button type="button" className={tab === "configuration" ? "active" : ""} onClick={() => setTab("configuration")}>Global & custom requests</button>
      </nav>
      {tab === "categories" && <>
        <div className="sbAdminCreate">
          <div><b>Add a category</b><p>New categories start inactive and without confirmed capacity. Set values before publishing.</p></div>
          <div className="sbAdminCreateFields">
            <label>Category name<input maxLength={100} placeholder="e.g. New gift category" value={newName} disabled={busy} onChange={e => setNewName(e.target.value)} /></label>
            <label>Type<select value={newKind} disabled={busy} onChange={e => setNewKind(e.target.value as Kind)}>{initialKinds.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label>Inside<select value={newParent} disabled={busy} onChange={e => setNewParent(e.target.value)}><option value="">Top-level</option>{groups.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
            <button type="button" disabled={busy || !newName.trim() || categories.length >= 200} onClick={addCategory}>+ Add</button>
          </div>
        </div>
        <div className="sbAdminTree">
          <div className="sbAdminSectionCaption"><span>01 / CATEGORY HIERARCHY</span><p>Reorder, rename and activate categories. Folders can contain subcategories. Each size belongs to its parent category.</p></div>
          {topLevel.map(c => {
            const siblings = categories.filter(x => x.parentId === null)
            const children = sortByOrder(categories.filter(x => x.parentId === c.id))
            return <div key={c.id} className="sbAdminGroup">
              <CategoryRow category={c} siblings={siblings} allCategories={categories} options={options.filter(o => o.categoryId === c.id)} busy={busy}
                patch={changes => patchCategory(c.id, changes)} moveCategory={delta => moveCategory(c.id, delta)}
                patchOption={patchOption} addOption={() => addOption(c.id)} removeOption={removeOption}
                moveOption={moveOption} removeCategory={() => removeCategory(c.id)} />
              {children.length > 0 && <div className="sbAdminChildGrid">{children.map(child => <CategoryRow key={child.id} category={child}
                siblings={children} allCategories={categories} options={options.filter(o => o.categoryId === child.id)} busy={busy}
                patch={changes => patchCategory(child.id, changes)} moveCategory={delta => moveCategory(child.id, delta)}
                patchOption={patchOption} addOption={() => addOption(child.id)} removeOption={removeOption}
                moveOption={moveOption} removeCategory={() => removeCategory(child.id)} />)}</div>}
            </div>
          })}
          {!topLevel.length && <p className="sbAdminEmpty">No top-level categories. Add one above.</p>}
        </div>
      </>}
      {tab === "configuration" && <div className="sbAdminConfiguration">
        <div className="sbAdminSectionCaption"><span>02 / GLOBAL SETTINGS</span><p>All changes are stored in the existing database. Customer activation cannot be changed here.</p></div>
        <div className="sbAdminFields">
          <label>Default private budget per category unit (₹)
            <input type="number" min="0" max="21474836" step="0.01" disabled={busy}
              value={money(state.config.defaultCatalogItemBudgetPaise)} onChange={e => edit(s => ({ ...s, config: { ...s.config, defaultCatalogItemBudgetPaise: toPaise(e.target.value) } }))} />
            <small>Fallback for future category quotes; current category rows have their own amounts.</small>
          </label>
          <label className="sbAdminCheck sbAdminToggle">
            <input type="checkbox" disabled={busy} checked={state.config.allowMultipleQuantities}
              onChange={e => edit(s => ({ ...s, config: { ...s.config, allowMultipleQuantities: e.target.checked } }))} />
            Allow multiple quantities (approved)
          </label>
        </div>
        <label className="sbAdminPrompt">Anything Else? customer prompt
          <textarea rows={4} maxLength={500} disabled={busy} value={state.config.otherRequestPrompt}
            onChange={e => edit(s => ({ ...s, config: { ...s.config, otherRequestPrompt: e.target.value } }))} />
          <small>Customer asks, team discusses; never automatically charge for an unconfirmed request.</small>
        </label>
        <div className="sbAdminLocked"><b>Protected launch controls</b><p>Customer Self-Build orders: DISABLED · Per-category price visibility: DISABLED. Both are enforced by PostgreSQL constraints, not editable from this admin screen.</p></div>
      </div>}
      <div className="sbAdminFooter"><p>{dirty ? "Changes are only in this browser until you publish." : "Settings shown above are loaded from PostgreSQL."} {state.categories.some(c => c.availabilityConfirmed) || state.options.some(o => o.availabilityConfirmed) ? "Confirmed counts are not reserved by checkout yet." : "No category or pack capacity has been confirmed yet."}</p>
        <button type="button" className="sbAdminPublish" disabled={!dirty || busy} onClick={() => void publish()}>{busy ? "Saving…" : "Publish category settings"}</button></div>
    </div>}
  </section>
}
