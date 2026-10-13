"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SelfBuildCapacityState } from "../../lib/server/self-build-capacity"

type Message={type:"error"|"success";text:string}
const fmt=(paise:number)=>String(paise/100)
function units(raw:string) {
  if(!/^(?:0|[1-9][0-9]{0,6})$/.test(raw))return null
  const n=Number(raw)
  return Number.isSafeInteger(n)&&n<=1_000_000?n:null
}
function paise(raw:string) {
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null
  const n=Math.round(Number(raw)*100)
  return Number.isSafeInteger(n)&&n>=0&&n<=2_147_483_647?n:null
}

export function AdminSelfBuildCapacity(){
  const [state,setState]=useState<SelfBuildCapacityState|null>(null)
  const [baseline,setBaseline]=useState("")
  const [pending,setPending]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState<Message|null>(null)
  const dirty=state!==null&&JSON.stringify(state)!==baseline

  const reload=useCallback(async()=>{
    setLoading(true);setNotice(null)
    try{
      const response=await fetch("/api/admin/self-build/capacity",{cache:"no-store",credentials:"same-origin"})
      const data:unknown=await response.json()
      if(!response.ok||!data||typeof data!=="object"||!("ok" in data)||data.ok!==true)
        throw Error("Could not load category availability. Try again.")
      const source=data as unknown as SelfBuildCapacityState
      const copy={version:source.version,settingsVersion:source.settingsVersion,
        categories:source.categories,options:source.options,tiers:source.tiers}
      setState(copy);setBaseline(JSON.stringify(copy));setPending({})
    }catch(e){setNotice({type:"error",text:e instanceof Error?e.message:"Unable to load."})}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void reload()},[reload])

  const rows=useMemo(()=>state?[
    ...state.categories.map(c=>({...c,kind:"category" as const,
      display:c.parentLabel?`${c.parentLabel} / ${c.label}`:c.label})),
    ...state.options.map(o=>({...o,kind:"option" as const,display:`${o.groupLabel} / ${o.label}`}))
  ]:[],[state])

  function setAvailable(kind:"category"|"option",id:string,raw:string){
    const key=`${kind}:${id}`
    setPending(v=>({...v,[key]:raw}))
    const parsed=units(raw)
    if(parsed===null)return
    setState(v=>v?{...v,[kind==="category"?"categories":"options"]:
      v[kind==="category"?"categories":"options"].map(row=>row.id===id?{...row,availableUnits:parsed}:row)}:v)
  }
  function setVerified(kind:"category"|"option",id:string,verified:boolean){
    setState(v=>v?{...v,[kind==="category"?"categories":"options"]:
      v[kind==="category"?"categories":"options"].map(row=>row.id===id?{...row,verified}:row)}:v)
  }
  function setTierAllowance(id:string,raw:string){
    setPending(v=>({...v,[`tier:${id}`]:raw}))
    const parsed=paise(raw)
    if(parsed===null)return
    setState(v=>v?{...v,tiers:v.tiers.map(row=>row.id===id?{...row,allowancePaise:parsed}:row)}:v)
  }
  function setTierEnabled(id:string,enabled:boolean){
    setState(v=>v?{...v,tiers:v.tiers.map(row=>row.id===id?{...row,enabled}:row)}:v)
  }
  function invalid():string|null{
    if(!state)return "Capacity settings not loaded."
    if(Object.values(pending).some((v,index)=>{
      const key=Object.keys(pending)[index]
      return key.startsWith("tier:")?paise(v)===null:units(v)===null
    }))return "Fix invalid numbers before saving."
    for(const row of [...state.categories,...state.options]){
      if(!Number.isSafeInteger(row.availableUnits)||row.availableUnits<row.reservedUnits)
        return `Cannot set ${row.label} below already reserved units.`
    }
    if(state.tiers.some(t=>t.enabled&&t.allowancePaise<=0))
      return "Enable a tier only after entering its internal allowance."
    return null
  }
  async function save(){
    if(!state||!dirty)return
    const problem=invalid()
    if(problem){setNotice({type:"error",text:problem});return}
    setSaving(true);setNotice(null)
    try{
      const response=await fetch("/api/admin/self-build/capacity",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({version:state.version,settingsVersion:state.settingsVersion,
          categories:state.categories.map(c=>({id:c.id,availableUnits:c.availableUnits,verified:c.verified})),
          options:state.options.map(o=>({id:o.id,availableUnits:o.availableUnits,verified:o.verified})),
          tiers:state.tiers.map(t=>({id:t.id,allowancePaise:t.allowancePaise,enabled:t.enabled}))})
      })
      const data:unknown=await response.json()
      if(!response.ok){
        const code=data&&typeof data==="object"&&"error" in data?String(data.error):"UNKNOWN_ERROR"
        if(response.status===409)throw Error("Categories or availability changed in another session. Reload first, then edit again.")
        throw Error(`Save rejected: ${code}. No partial changes were published.`)
      }
      const next=data as SelfBuildCapacityState
      const copy={version:next.version,settingsVersion:next.settingsVersion,
        categories:next.categories,options:next.options,tiers:next.tiers}
      setState(copy);setBaseline(JSON.stringify(copy));setPending({})
      setNotice({type:"success",text:"Verified category capacity and private tier allowances saved."})
    }catch(e){setNotice({type:"error",text:e instanceof Error?e.message:"Save failed."})}
    finally{setSaving(false)}
  }
  function discard(){
    if(!dirty||window.confirm("Discard unsaved availability and allowance changes?"))void reload()
  }

  return <section className="sbAdminCapacity" aria-label="Category fulfilment inventory">
    <div className="sbAdminSectionHead">
      <h3>Category availability &amp; private tier budgets</h3>
      <p>Confirm how many category units your team can physically prepare. No retail SKU mapping and no automated stock deduction yet.</p>
    </div>
    <div className="sbAdminNotice" role="note"><strong>Safe default:</strong> All categories start unverified with 0 available units, and no tier is enabled for Self-Build budgets. Admin entries do not automatically create stock or accept purchases.</div>
    {notice&&<p className={notice.type==="error"?"sbAdminFeedback sbAdminFeedbackError":"sbAdminFeedback sbAdminFeedbackSuccess"} role="status">{notice.text}</p>}
    {!state?<button type="button" className="secondary" disabled={loading} onClick={()=>void reload()}>{loading?"Loading…":"Retry loading"}</button>:<>
      <div className="sbCapacitySection">
        <div className="sbCapacityTitle"><h4>Category &amp; option units</h4><span>{rows.length} choices · DB version {state.version}</span></div>
        <div className="sbCapacityList">{rows.map(row=>{
          const key=`${row.kind}:${row.id}`
          return <div className="sbCapacityRow" key={key}>
            <div className="sbCapacityLabel"><strong>{row.display}</strong><small>{!row.active?"Category disabled in design · ":""}{row.reservedUnits? `${row.reservedUnits} reserved · `:""} {row.kind==="option"?"Size/option":"Category"} · {row.verified?"Staff-verified":"Unverified"}</small></div>
            <label className="sbCapacityQuantity">Available units<input aria-label={`Available units for ${row.display}`} inputMode="numeric" value={pending[key]??String(row.availableUnits)} onChange={event=>setAvailable(row.kind,row.id,event.target.value)} /></label>
            <label className="sbAdminToggle"><input type="checkbox" checked={row.verified} onChange={event=>setVerified(row.kind,row.id,event.target.checked)}/><span>Verified</span></label>
          </div>
        })}</div>
      </div>
      <div className="sbCapacitySection">
        <div className="sbCapacityTitle"><h4>Private hamper budget allowances</h4><span>Separate from retail selling price</span></div>
        <p className="sbCapacityHint">Automatic private budget targets: 80% of the hamper price up to ₹999, and 75% from ₹1,299 upwards. A single selection may use up to 5 extra percentage points in total. These values follow published tier prices automatically. No inventory is needed or checked for Self-Build checkout.</p>
        <div className="sbCapacityList">{state.tiers.map(t=><div key={t.id} className="sbCapacityRow">
          <div className="sbCapacityLabel"><strong>{t.label}</strong><small>Customer hamper tier: ₹{fmt(t.sellingPricePaise)} · internal allowance is private</small></div>
          <label className="sbCapacityQuantity">Internal allowance ₹<input aria-label={`Private allowance for ${t.label}`} inputMode="decimal" value={fmt(t.allowancePaise)} readOnly aria-readonly="true" title="Automatic from the published hamper price" /></label>
          <label className="sbAdminToggle"><input type="checkbox" checked={t.enabled} disabled title="Automatic tier policy"/><span>Configured</span></label>
        </div>)}</div>
      </div>
      <div className="sbAdminFooter">
        <button type="button" className="sbAdminSave" onClick={()=>void save()} disabled={saving||loading||!dirty}>{saving?"Saving…":"Save availability & allowances"}</button>
        <button type="button" className="secondary" onClick={discard} disabled={saving||loading||!dirty}>Discard changes</button>
        <span>{dirty?"Unsaved changes · ":""}Version-checked, atomic settings. Checkout remains disabled.</span>
      </div>
    </>}
  </section>
}
