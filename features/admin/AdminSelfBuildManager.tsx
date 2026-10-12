"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SelfBuildAdminState, SelfBuildCategory, SelfBuildOption } from "../../lib/server/self-build-admin"

type Group = "categories" | "options" | "settings"
type Message = { kind: "success" | "error"; text: string }
const kindNames: Record<SelfBuildCategory["selectionKind"], string> = {
  group: "Folder / group", category: "Choose category + quantity",
  variant: "Choose size / option", photo: "Photos + quantity", notes: "Team request"
}

function money(paise: number | null) { return paise === null ? "" : String(paise / 100) }
function parseRupees(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const paise = Math.round(Number(trimmed) * 100)
  return Number.isSafeInteger(paise) && paise >= 0 && paise <= 2_147_483_647 ? paise : null
}
function slug(label: string, used: Set<string>) {
  const base = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45)
  if (!base) return null
  for (let index = 0; index < 1000; index++) {
    const candidate = index ? `${base}-${index + 1}` : base
    if (!used.has(candidate)) return candidate
  }
  return null
}

export function AdminSelfBuildManager() {
  const [state, setState] = useState<SelfBuildAdminState | null>(null)
  const [baseline, setBaseline] = useState("")
  const [section, setSection] = useState<Group>("categories")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Message | null>(null)
  const [newParent, setNewParent] = useState("")
  const [newKind, setNewKind] = useState<SelfBuildCategory["selectionKind"]>("category")
  const [newLabel, setNewLabel] = useState("")
  const [newOptionCategory, setNewOptionCategory] = useState("")
  const [newOptionLabel, setNewOptionLabel] = useState("")
  const [newOptionCost, setNewOptionCost] = useState("100")
  const [editingAmounts, setEditingAmounts] = useState<Record<string,string>>({})
  const dirty = state !== null && JSON.stringify(state) !== baseline
  const categoryGroups = useMemo(() => state?.categories.filter(c => c.selectionKind === "group") ?? [], [state])
  const variantGroups = useMemo(() => state?.categories.filter(c => c.selectionKind === "variant") ?? [], [state])

  const load = useCallback(async () => {
    setLoading(true); setFeedback(null)
    try {
      const response = await fetch("/api/admin/self-build", { cache: "no-store", credentials: "same-origin" })
      const data: unknown = await response.json()
      if (!response.ok || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true) throw Error("Could not load current settings. Refresh and try again.")
      const received = data as unknown as SelfBuildAdminState
      const next = { version: received.version, config: received.config, categories: received.categories, options: received.options }
      setState(next); setBaseline(JSON.stringify(next));setEditingAmounts({})
    } catch (error) {
      setFeedback({ kind:"error", text: error instanceof Error ? error.message : "Unable to load settings." })
    } finally {setLoading(false)}
  }, [])
  useEffect(() => { void load() }, [load])

  function updateCategory(id: string, update: Partial<SelfBuildCategory>) {
    setState(current => current ? { ...current, categories:current.categories.map(c=>c.id===id?{...c,...update}:c) } : current)
  }
  function updateOption(id: string, update: Partial<SelfBuildOption>) {
    setState(current=>current?{...current,options:current.options.map(o=>o.id===id?{...o,...update}:o)}:current)
  }
  function updateCategoryAmount(id:string,raw:string) {
    setEditingAmounts(values=>({...values,[`c:${id}`]:raw}))
    const amount=parseRupees(raw)
    if(amount!==null) updateCategory(id,{unitBudgetPaise:amount})
  }
  function updateOptionAmount(id:string,raw:string) {
    setEditingAmounts(values=>({...values,[`o:${id}`]:raw}))
    const amount=parseRupees(raw)
    if(amount!==null) updateOption(id,{unitBudgetPaise:amount})
  }
  function addCategory() {
    if(!state)return
    const label=newLabel.trim(),id=slug(label,new Set(state.categories.map(c=>c.id)))
    if(!label || label.length>100 || !id){setFeedback({kind:"error",text:"Enter a valid category name (maximum 100 characters)."});return}
    if(newParent && !categoryGroups.some(c=>c.id===newParent)){setFeedback({kind:"error",text:"Choose an existing folder as parent."});return}
    const mode=newKind==="category" || newKind==="photo" ? "per_unit" : newKind==="variant" ? "option":"none"
    const cost=newKind==="category" ? state.config.defaultCatalogItemBudgetPaise : newKind==="photo" ? 0 : null
    const order=state.categories.filter(c=>c.parentId===(newParent||null)).reduce((m,c)=>Math.max(m,c.displayOrder),0)+10
    const category:SelfBuildCategory={id,parentId:newParent||null,label,selectionKind:newKind,chargeMode:mode,unitBudgetPaise:cost,displayOrder:order,active:true}
    setState({...state,categories:[...state.categories,category]});setNewLabel("");setFeedback({kind:"success",text:"Category added to unsaved changes. Save changes to publish to the database."})
  }
  function removeCategory(category:SelfBuildCategory) {
    if(!state)return
    if(state.categories.some(c=>c.parentId===category.id) || state.options.some(o=>o.categoryId===category.id)){
      setFeedback({kind:"error",text:"Remove this folder's child categories / size options first."});return
    }
    if(!window.confirm(`Remove “${category.label}” from Self-Build settings? This does not affect existing retail products.`))return
    setState({...state,categories:state.categories.filter(c=>c.id!==category.id)})
    setFeedback(null)
  }
  function addOption() {
    if(!state)return
    const category=state.categories.find(c=>c.id===newOptionCategory&&c.selectionKind==="variant")
    const label=newOptionLabel.trim(),amount=parseRupees(newOptionCost)
    if(!category || !label || label.length>100 || amount===null){setFeedback({kind:"error",text:"Select size group, enter a label and a valid non-negative internal budget."});return}
    const id=slug(`${category.id}-${label}`,new Set(state.options.map(o=>o.id)))
    if(!id){setFeedback({kind:"error",text:"Unable to create a unique option ID."});return}
    const order=state.options.filter(o=>o.categoryId===category.id).reduce((m,o)=>Math.max(m,o.displayOrder),0)+10
    setState({...state,options:[...state.options,{id,categoryId:category.id,label,unitBudgetPaise:amount,displayOrder:order,active:true}]})
    setNewOptionLabel("");setFeedback({kind:"success",text:"Size option added to unsaved changes. Save to persist."})
  }
  function removeOption(option:SelfBuildOption) {
    if(!state)return
    if(!window.confirm(`Remove option “${option.label}”? This does not alter customer orders.`))return
    setState({...state,options:state.options.filter(o=>o.id!==option.id)});setFeedback(null)
  }
  function valid() {
    if(!state)return "Settings are not loaded."
    if(Object.entries(editingAmounts).some(([key,raw])=>{
      const found=key==="default"|| (key.startsWith("c:")?state.categories.some(c=>c.id===key.slice(2)):state.options.some(o=>o.id===key.slice(2)))
      return found&&parseRupees(raw)===null
    }))return "Fix invalid budget fields. Use ₹ amounts with up to two decimal places."
    if(state.categories.some(c=>!c.label.trim()||c.label.trim().length>100||!Number.isSafeInteger(c.displayOrder)||Math.abs(c.displayOrder)>1_000_000))return "Fix category labels or display order."
    if(state.options.some(o=>!o.label.trim()||o.label.trim().length>100||!Number.isSafeInteger(o.displayOrder)||Math.abs(o.displayOrder)>1_000_000))return "Fix option labels or display order."
    if(!state.config.otherRequestPrompt.trim()||state.config.otherRequestPrompt.length>500)return "Request prompt must be 1–500 characters."
    return null
  }
  async function save() {
    const issue=valid()
    if(issue){setFeedback({kind:"error",text:issue});return}
    if(!state||!dirty)return
    setSaving(true);setFeedback(null)
    try {
      const response=await fetch("/api/admin/self-build",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)
      })
      const data:unknown=await response.json()
      const code=data&&typeof data==="object"&&"error" in data ? String(data.error):"UNKNOWN_ERROR"
      if(!response.ok){
        if(response.status===409)throw Error("Settings changed in another admin session. Reload current settings before editing again.")
        throw Error(`Save was rejected: ${code}. No partial settings were published.`)
      }
      const next=data as SelfBuildAdminState
      const clean={version:next.version,config:next.config,categories:next.categories,options:next.options}
      setState(clean);setBaseline(JSON.stringify(clean));setEditingAmounts({})
      setFeedback({kind:"success",text:"Self-Build category settings saved to PostgreSQL. The design preview now uses these labels and options."})
    } catch(error){setFeedback({kind:"error",text:error instanceof Error?error.message:"Save failed."})}
    finally{setSaving(false)}
  }
  function discard(){
    if(!dirty||window.confirm("Discard all unsaved Self-Build edits?"))void load()
  }
  return <section className="sbAdmin" aria-label="Self-build hamper administration">
    <div className="sbAdminHero">
      <div><span className="sbAdminEyebrow">CELEBRATION · HAMPER CONFIGURATION</span><h2>Self-Build Studio</h2><p>Manage the categories, sizes and private budget consumption customers will eventually choose from. No individual jewellery SKU mapping.</p></div>
      <a href="/admin/self-build-preview" className="sbAdminPreview">View design preview ↗</a>
    </div>
    <div className="sbAdminNotice" role="note"><strong>Customer orders are disabled.</strong> Editing these settings does not activate checkout, reserve inventory, or display private budget amounts to customers.</div>
    {feedback && <div className={feedback.kind==="error"?"sbAdminFeedback sbAdminFeedbackError":"sbAdminFeedback sbAdminFeedbackSuccess"} role="status">{feedback.text}</div>}
    <div className="sbAdminToolbar">
      <div className="sbAdminTabs" role="group" aria-label="Self-Build editor sections">
        <button className={section==="categories"?"active":""} onClick={()=>setSection("categories")}>Categories</button>
        <button className={section==="options"?"active":""} onClick={()=>setSection("options")}>Sizes &amp; options</button>
        <button className={section==="settings"?"active":""} onClick={()=>setSection("settings")}>Rules &amp; notes</button>
      </div>
      <div className="sbAdminStatus">{loading?"Loading…":state?`DB version ${state.version}`:"Not loaded"}{dirty&&<b> · Unsaved edits</b>}</div>
    </div>
    {!state&&<button type="button" className="secondary" disabled={loading} onClick={()=>void load()}>Retry loading</button>}
    {state&&section==="categories"&&<div className="sbAdminBody">
      <div className="sbAdminSectionHead"><h3>Category structure</h3><p>Folders reveal their subcategories. Selected category quantities consume a private internal budget; no retail products or SKU mappings are used.</p></div>
      <div className="sbAdminRows">{state.categories.map(category=>{
        const isAmount=category.selectionKind==="category"||category.selectionKind==="photo"
        return <article key={category.id} className="sbAdminRow" style={{marginLeft:category.parentId?"min(24px,4vw)":undefined}}>
          <div className="sbAdminRowTop"><span className="sbAdminPill">{kindNames[category.selectionKind]}</span><code>{category.id}</code></div>
          <div className="sbAdminFields">
            <label>Name<input value={category.label} maxLength={100} onChange={e=>updateCategory(category.id,{label:e.target.value})}/></label>
            <label>Order<input type="number" min="-1000000" max="1000000" step="1" value={category.displayOrder} onChange={e=>updateCategory(category.id,{displayOrder:Number(e.target.value)})}/></label>
            {isAmount&&<label>Internal ₹ / unit<input type="text" inputMode="decimal" value={editingAmounts[`c:${category.id}`]??money(category.unitBudgetPaise)} onChange={e=>updateCategoryAmount(category.id,e.target.value)}/></label>}
          </div>
          <div className="sbAdminRowActions"><label className="sbAdminToggle"><input type="checkbox" checked={category.active} onChange={e=>updateCategory(category.id,{active:e.target.checked})}/><span>Enabled in preview</span></label><button type="button" className="sbAdminDelete" onClick={()=>removeCategory(category)}>Remove</button></div>
        </article>
      })}</div>
      <div className="sbAdminAdd">
        <h4>Add category or folder</h4><div className="sbAdminAddGrid">
          <label>Name<input value={newLabel} maxLength={100} onChange={e=>setNewLabel(e.target.value)} placeholder="Category name"/></label>
          <label>Type<select value={newKind} onChange={e=>{const next=e.target.value as SelfBuildCategory["selectionKind"];setNewKind(next);if(next==="notes")setNewParent("")}}>{Object.entries(kindNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          <label>Inside folder<select value={newParent} onChange={e=>setNewParent(e.target.value)} disabled={newKind==="notes"}><option value="">Top level</option>{categoryGroups.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label>
        </div><button type="button" className="secondary" onClick={addCategory}>+ Add category</button>
      </div>
    </div>}
    {state&&section==="options"&&<div className="sbAdminBody">
      <div className="sbAdminSectionHead"><h3>Chocolates, Snacks, Perfume &amp; other sizes</h3><p>These size names and private budget values are stored in the database. Starter, Mini, Medium, Large and Mega are editable rather than hardcoded.</p></div>
      <div className="sbAdminRows">{state.options.map(option=>{
        const group=state.categories.find(c=>c.id===option.categoryId)
        return <article className="sbAdminRow" key={option.id}>
          <div className="sbAdminRowTop"><span className="sbAdminPill">{group?.label??option.categoryId}</span><code>{option.id}</code></div>
          <div className="sbAdminFields">
            <label>Size / option name<input value={option.label} maxLength={100} onChange={e=>updateOption(option.id,{label:e.target.value})}/></label>
            <label>Internal budget ₹<input type="text" inputMode="decimal" value={editingAmounts[`o:${option.id}`]??money(option.unitBudgetPaise)} onChange={e=>updateOptionAmount(option.id,e.target.value)}/></label>
            <label>Order<input type="number" min="-1000000" max="1000000" step="1" value={option.displayOrder} onChange={e=>updateOption(option.id,{displayOrder:Number(e.target.value)})}/></label>
          </div>
          <div className="sbAdminRowActions"><label className="sbAdminToggle"><input type="checkbox" checked={option.active} onChange={e=>updateOption(option.id,{active:e.target.checked})}/><span>Enabled in preview</span></label><button type="button" className="sbAdminDelete" onClick={()=>removeOption(option)}>Remove</button></div>
        </article>
      })}</div>
      <div className="sbAdminAdd"><h4>Add a new size / option</h4><div className="sbAdminAddGrid">
        <label>Category<select value={newOptionCategory} onChange={e=>setNewOptionCategory(e.target.value)}><option value="">Choose a size group</option>{variantGroups.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Size name<input value={newOptionLabel} maxLength={100} onChange={e=>setNewOptionLabel(e.target.value)} placeholder="e.g. Extra Large"/></label>
        <label>Internal budget ₹<input inputMode="decimal" value={newOptionCost} onChange={e=>setNewOptionCost(e.target.value)}/></label>
      </div><button type="button" className="secondary" onClick={addOption}>+ Add size</button></div>
    </div>}
    {state&&section==="settings"&&<div className="sbAdminBody">
      <div className="sbAdminSectionHead"><h3>Global rules &amp; extra requests</h3><p>These settings apply only to the staged Self-Build workflow, not to Celebration's existing retail or curated hamper checkout.</p></div>
      <div className="sbAdminSettings">
        <label>Default internal category budget (₹)<input type="text" inputMode="decimal" value={editingAmounts["default"]??money(state.config.defaultCatalogItemBudgetPaise)} onChange={e=>{
          const raw=e.target.value;setEditingAmounts(v=>({...v,default:raw}))
          const number=parseRupees(raw);if(number!==null)setState(v=>v?{...v,config:{...v.config,defaultCatalogItemBudgetPaise:number}}:v)
        }}/></label>
        <label className="sbAdminToggle"><input type="checkbox" checked={state.config.allowMultipleQuantities} onChange={e=>setState(v=>v?{...v,config:{...v.config,allowMultipleQuantities:e.target.checked}}:v)}/><span>Allow multiple quantities of a category or option</span></label>
        <label className="sbAdminFull">Anything Else? — customer prompt<textarea rows={4} maxLength={500} value={state.config.otherRequestPrompt} onChange={e=>setState(v=>v?{...v,config:{...v.config,otherRequestPrompt:e.target.value}}:v)}/></label>
        <div className="sbAdminNotice"><strong>Safety locks:</strong> Customer Self-Build checkout: OFF · Internal prices shown to customers: NEVER. These are secured database-level protections, not admin toggles.</div>
      </div>
    </div>}
    {state&&<div className="sbAdminFooter"><button type="button" className="sbAdminSave" onClick={()=>void save()} disabled={loading||saving||!dirty}>{saving?"Saving…":"Save Self-Build settings"}</button><button type="button" className="secondary" disabled={saving||loading||!dirty} onClick={discard}>Discard changes</button><span>Edits are atomic and version-protected.</span></div>}
  </section>
}
