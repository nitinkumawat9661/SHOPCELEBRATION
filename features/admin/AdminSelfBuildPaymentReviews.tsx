"use client"

import { useEffect,useState } from "react"
type Review={publicOrderId:string;reason:string;reviewStatus:"open"|"documented";amountPaise:number;paymentStatus:string;orderStatus:string;createdAt:string;externalReference:string|null;documentedAt:string|null}
export function AdminSelfBuildPaymentReviews(){
  const [reviews,setReviews]=useState<Review[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [reference,setReference]=useState<Record<string,string>>({})
  const [note,setNote]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState("")
  const [ready,setReady]=useState(false)
  async function load(){
    setBusy(true);setError("")
    try{
      const response=await fetch("/api/admin/self-build/payment-reviews",{credentials:"same-origin",cache:"no-store"})
      const body=await response.json() as {ok:boolean;reviews?:Review[]}
      if(!response.ok||!body.ok||!Array.isArray(body.reviews))throw Error("REVIEW_FETCH_UNAVAILABLE")
      setReviews(body.reviews);setReady(true)
    }catch{setError("Payment review queue unavailable. Retry to check for refunds.")}
    finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[])
  async function document(row:Review){
    const key=row.publicOrderId+":"+row.reason
    if((reference[key]||"").trim().length<4||(note[key]||"").trim().length<8){
      setError("Enter the verified gateway/bank refund reference and a note (minimum 8 characters).")
      return
    }
    if(!window.confirm("Confirm you have checked the actual payment/refund in the provider panel? This only records a reference and does NOT move money."))return
    setSaving(key);setError("")
    try{
      const r=await fetch("/api/admin/self-build/payment-reviews",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({publicOrderId:row.publicOrderId,reason:row.reason,
          externalReference:reference[key].trim(),note:note[key].trim()})
      })
      if(!r.ok)throw Error("REVIEW_UPDATE_FAILED")
      await load()
    }catch{setError("Could not save payment review. Nothing was refunded automatically.")}
    finally{setSaving("")}
  }
  return <section className="adminWorkspaceCard sbAdminPaymentReviews" aria-label="Self-Build payment and refund reviews">
    <div className="adminWorkspaceHead">
      <div><div className="kicker">PAYMENT SAFETY</div><h2>Refund & payment reviews</h2></div>
      <button className="secondary" type="button" disabled={busy} onClick={()=>void load()}>Refresh</button>
    </div>
    <p>Only Self-Build orders appear here. A cancelled paid order or a payment received after cancellation requires manual gateway reconciliation. <strong>Recording a reference never initiates a refund.</strong></p>
    {error&&<p role="alert" className="errorBox">{error}</p>}
    {!ready&&busy&&<p role="status">Loading payment reviews…</p>}
    {ready&&reviews.length===0&&<p role="status">No Self-Build payment issues are queued.</p>}
    {reviews.map(row=>{
      const key=row.publicOrderId+":"+row.reason
      return <div className="sbAdminPaymentReviewItem" key={key}>
        <div><b>{row.publicOrderId}</b><span>{row.reason==="LATE_PAYMENT_AFTER_CANCELLATION"?"Payment after cancellation":"Paid order cancelled"}</span></div>
        <p>₹{(row.amountPaise/100).toFixed(2)} · {row.orderStatus} · {row.paymentStatus} · {row.reviewStatus}</p>
        {row.reviewStatus==="documented"
          ?<p>Reference recorded: <b>{row.externalReference}</b>. Verify in the payment provider for the actual refund status.</p>
          :<div className="sbAdminPaymentReviewForm">
            <label>Gateway/bank reference<input value={reference[key]||""}
              onChange={e=>setReference(v=>({...v,[key]:e.target.value}))}
              maxLength={140} placeholder="Verified refund transaction reference" /></label>
            <label>Review note<input value={note[key]||""}
              onChange={e=>setNote(v=>({...v,[key]:e.target.value}))}
              maxLength={500} placeholder="What was verified with the payment provider?" /></label>
            <button type="button" disabled={Boolean(saving)} onClick={()=>void document(row)}>Record reference (no money movement)</button>
          </div>}
      </div>
    })}
  </section>
}
