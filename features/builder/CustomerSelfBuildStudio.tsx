"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { orderConfig } from "../../config/order"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"
import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/catalog"
import type { SelfBuildVisualData } from "../../lib/server/self-build-preview"
import { useCustomerAccount } from "../account/useCustomerAccount"
import { CustomerAuthPanel } from "../account/CustomerAuthPanel"
import { todayForDateInput, validateCheckoutDetails } from "./validation"
import type { CheckoutData } from "./types"

type Selection={kind:"category"|"option";id:string;quantity:number}
type Draft={id:string;tierId:string;selections:Selection[];otherRequestText:string;expiresAt:string}
type Photo={id:string;sizeBytes:number;createdAt:string}
type PaymentCheckout=
  |{provider:"razorpay";mode:"test"|"live";providerOrderId:string;keyId:string;amountPaise:number;currency:"INR"}
  |{provider:"cashfree";mode:"test"|"live";providerOrderId:string;paymentSessionId:string;amountPaise:number;currency:"INR"}
type PaymentReply={ok?:boolean;paid?:boolean;error?:string;orderId?:string;trackingPath?:string;
  paymentStatus?:string;checkout?:PaymentCheckout;payablePaise?:number}
type SDKWindow=Window&{
  Razorpay?:new(o:Record<string,unknown>)=>{open:()=>void}
  Cashfree?:(config:{mode:"sandbox"|"production"})=>{checkout:(args:{
    paymentSessionId:string;redirectTarget:"_modal"|"_self"
  })=>Promise<unknown>}
}
const emptyDelivery:CheckoutData={
  customerName:"",phone:"",receiverName:"",address:"",city:"",state:"",pincode:"",
  requiredDate:"",occasion:"",message:"",paymentReference:""
}
function loadScript(src:string){
  return new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if(existing?.dataset.loaded==="true"){resolve();return}
    const script=existing||document.createElement("script")
    const ready=()=>{script.dataset.loaded="true";resolve()}
    script.addEventListener("load",ready,{once:true})
    script.addEventListener("error",()=>reject(Error("PAYMENT_SDK_UNAVAILABLE")),{once:true})
    if(!existing){script.src=src;script.async=true;document.head.appendChild(script)}
  })
}
async function fetchPayment(publicId:string):Promise<PaymentReply>{
  const r=await fetch(`/api/payments/status?orderId=${encodeURIComponent(publicId)}`,{cache:"no-store"})
  const data=await r.json() as PaymentReply
  if(!r.ok||!data.ok)throw Error("PAYMENT_STATUS_UNAVAILABLE")
  return data
}
async function verifyPayment(body:Record<string,string>):Promise<PaymentReply>{
  const r=await fetch("/api/payments/verify",{method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify(body)})
  const data=await r.json() as PaymentReply
  if(!r.ok||!data.ok)throw Error(data.error||"PAYMENT_VERIFY_FAILED")
  return data
}
async function launch(checkout:PaymentCheckout,publicOrderId:string,details:CheckoutData,tier:Tier){
  if(checkout.provider==="razorpay"){
    await loadScript("https://checkout.razorpay.com/v1/checkout.js")
    const SDK=(window as SDKWindow).Razorpay
    if(!SDK)throw Error("PAYMENT_SDK_UNAVAILABLE")
    const confirmation=await new Promise<{razorpay_payment_id:string;razorpay_order_id:string;razorpay_signature:string}|null>((resolve)=>{
      let finished=false
      const finish=(value:{razorpay_payment_id:string;razorpay_order_id:string;razorpay_signature:string}|null)=>{
        if(finished)return;finished=true;resolve(value)
      }
      const checkoutInstance=new SDK({
        key:checkout.keyId,amount:checkout.amountPaise,currency:checkout.currency,
        name:"Celebration",description:tier.name,order_id:checkout.providerOrderId,
        prefill:{name:details.customerName,contact:details.phone},
        theme:{color:"#752e49"},
        handler:(value:unknown)=>finish(value as {razorpay_payment_id:string;razorpay_order_id:string;razorpay_signature:string}),
        modal:{ondismiss:()=>finish(null)}
      })
      checkoutInstance.open()
    })
    if(confirmation){
      return verifyPayment({publicOrderId,provider:"razorpay",
        providerOrderId:confirmation.razorpay_order_id,
        providerPaymentId:confirmation.razorpay_payment_id,
        signature:confirmation.razorpay_signature})
    }
    return fetchPayment(publicOrderId)
  }
  await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js")
  const SDK=(window as SDKWindow).Cashfree
  if(!SDK)throw Error("PAYMENT_SDK_UNAVAILABLE")
  const cashfree=SDK({mode:checkout.mode==="live"?"production":"sandbox"})
  await cashfree.checkout({paymentSessionId:checkout.paymentSessionId,
    redirectTarget:window.matchMedia("(max-width: 767px), (pointer:coarse)").matches?"_self":"_modal"})
  const verified=await verifyPayment({publicOrderId,provider:"cashfree",providerOrderId:checkout.providerOrderId})
  return verified
}
function labelOf(data:SelfBuildVisualData,selection:Selection){
  if(selection.kind==="category")return data.categories.find(x=>x.id===selection.id)?.label||selection.id
  return data.options.find(x=>x.id===selection.id)?.label||selection.id
}

export function CustomerSelfBuildStudio({data,tiers,occasions}:{
  data:SelfBuildVisualData;tiers:Tier[];occasions:string[]
}){
  const customer=useCustomerAccount()
  const [tierId,setTierId]=useState(tiers[0]?.id||"")
  const [quantity,setQuantity]=useState<Record<string,number>>({})
  const [note,setNote]=useState("")
  const [draftId,setDraftId]=useState("")
  const [savedSignature,setSavedSignature]=useState("")
  const [photos,setPhotos]=useState<Photo[]>([])
  const [details,setDetails]=useState<CheckoutData>({
    ...emptyDelivery,occasion:occasions[0]||"",requiredDate:todayForDateInput()
  })
  const [accepted,setAccepted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [orderId,setOrderId]=useState("")
  const [paid,setPaid]=useState(false)
  const [trackingPath,setTrackingPath]=useState("")
  const key=useRef("")
  const inFlight=useRef(false)
  if(!key.current&&typeof window!=="undefined")key.current=crypto.randomUUID()
  const tier=tiers.find(t=>t.id===tierId)||tiers[0]
  const items=useMemo<Selection[]>(()=>Object.entries(quantity).flatMap(([id,value])=>{
    if(!Number.isSafeInteger(value)||value<1||value>100)return []
    const [kind,choiceId]=id.split(":")
    return(kind==="category"||kind==="option")?[{kind,id:choiceId,quantity:value}]:[]
  }),[quantity])
  // Count PIECES, not unique category cards: repeating the same option five
  // times consumes five of this hamper tier's publicly advertised slots.
  const selectedUnits=items.reduce((total,item)=>total+item.quantity,0)
  const maxUnits=tier?.maxChoices||0
  const tooManyItems=selectedUnits>maxUnits
  const photoQuantity=items.reduce((total,item)=>{
    return total+(item.kind==="category"&&data.categories.some(x=>x.id===item.id&&x.selectionKind==="photo")?item.quantity:0)
  },0)
  const signature=JSON.stringify({tierId,selections:items,note:note.trim()})
  const saved=Boolean(draftId)&&savedSignature===signature
  const readyToPay=saved&&items.length>0&&!tooManyItems&&photos.length===photoQuantity&&Boolean(tier)&&accepted&&Boolean(customer.account)
  const grouped=useMemo(()=>{
    const categoryNames=new Map(data.categories.map(c=>[c.id,c.label]))
    const selectable=data.categories.filter(c=>["category","photo"].includes(c.selectionKind)).map(c=>({
      key:`category:${c.id}`,label:c.label,group:c.parentId?categoryNames.get(c.parentId)||"":"",kind:c.selectionKind
    }))
    const options=data.options.map(o=>({
      key:`option:${o.id}`,label:o.label,group:categoryNames.get(o.categoryId)||"",kind:"variant"
    }))
    return [...selectable,...options]
  },[data])

  // Presentation-only grouping. Keep category IDs, selection quantities,
  // pricing, and the saved draft payload completely unchanged.
  const groupedSections=useMemo(()=>{
    const sections=new Map<string,typeof grouped>()
    for(const item of grouped){
      const title=item.group||"Gift categories"
      const section=sections.get(title)||[]
      section.push(item)
      sections.set(title,section)
    }
    return Array.from(sections,([title,choices])=>({title,choices}))
  },[grouped])
  const change=(name:keyof CheckoutData,value:string)=>setDetails(previous=>({...previous,[name]:value}))
  async function loadPhotos(){
    const result=await fetch("/api/account/self-build/photos",{cache:"no-store",credentials:"same-origin"})
    const body=await result.json() as {ok?:boolean;photos?:Photo[]}
    if(result.ok&&body.ok&&Array.isArray(body.photos))setPhotos(body.photos)
  }
  useEffect(()=>{
    const account=customer.account
    if(!account){setDraftId("");setSavedSignature("");setPhotos([]);setOrderId("");return}
    change("phone",account.phone)
    setDetails(prev=>({...prev,phone:account.phone,
      customerName:prev.customerName||account.displayName}))
    let disposed=false
    void (async()=>{
      try{
        const r=await fetch("/api/account/self-build/draft",{credentials:"same-origin",cache:"no-store"})
        const data=await r.json() as {ok?:boolean;draft?:Draft|null}
        if(disposed||!r.ok||!data.ok)return
        if(data.draft){
          setDraftId(data.draft.id);setTierId(data.draft.tierId);setNote(data.draft.otherRequestText)
          const restored=Object.fromEntries(data.draft.selections.map(x=>[`${x.kind}:${x.id}`,x.quantity]))
          setQuantity(restored)
          setSavedSignature(JSON.stringify({tierId:data.draft.tierId,
            selections:data.draft.selections,note:data.draft.otherRequestText.trim()}))
        }
        await loadPhotos()
      }catch{if(!disposed)setError("Saved draft could not be restored. Your current choices were not changed.")}
    })()
    try{
      const stored=sessionStorage.getItem(`celebration:self-build:payment:${account.id}`)
      if(stored)setOrderId(stored)
    }catch{}
    return()=>{disposed=true}
  },[customer.account?.id])
  async function saveDraft(){
    if(!customer.account)throw Error("SIGN_IN_REQUIRED")
    if(!tier||!items.length)throw Error("CHOOSE_A_CATEGORY")
    if(tooManyItems)throw Error("Reduce your selections to this hamper's maximum total pieces.")
    const r=await fetch("/api/account/self-build/draft",{
      method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({tierId:tier.id,selections:items,otherRequestText:note.trim()})
    })
    const response=await r.json() as {ok?:boolean;draft?:Draft;error?:string}
    if(!r.ok||!response.ok||!response.draft)throw Error(response.error||"DRAFT_SAVE_FAILED")
    setDraftId(response.draft.id);setSavedSignature(signature)
    return response.draft.id
  }
  async function onSave(){
    setError("");setBusy(true)
    try{await saveDraft();await loadPhotos();setNotice("Your choices are saved securely to your account.")}
    catch(e){setError(e instanceof Error?e.message:"DRAFT_SAVE_FAILED")}
    finally{setBusy(false)}
  }
  async function onPhotoUpload(file:File){
    if(!customer.account||!saved){setError("Save your latest selections before uploading photos.");return}
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>3*1024*1024||!file.size){
      setError("Choose a JPG, PNG or WebP photo under 3 MB.");return
    }
    setBusy(true);setError("")
    try{
      const r=await fetch("/api/account/self-build/photos",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type},body:file
      })
      const reply=await r.json() as {ok?:boolean;error?:string}
      if(!r.ok||!reply.ok)throw Error(reply.error||"PHOTO_UPLOAD_FAILED")
      await loadPhotos()
    }catch(e){setError(e instanceof Error?e.message:"PHOTO_UPLOAD_FAILED")}
    finally{setBusy(false)}
  }
  async function removePhoto(id:string){
    if(!window.confirm("Remove this personalised photo from your draft?"))return
    setBusy(true);setError("")
    try{
      const r=await fetch(`/api/account/self-build/photos/${encodeURIComponent(id)}`,{
        method:"DELETE",credentials:"same-origin"
      })
      if(!r.ok)throw Error("PHOTO_DELETE_FAILED")
      await loadPhotos()
    }catch(e){setError(e instanceof Error?e.message:"PHOTO_DELETE_FAILED")}
    finally{setBusy(false)}
  }
  async function confirmPayment(){
    if(inFlight.current||!customer.account||!tier)return
    if(!readyToPay){setError("Save your choices, add all selected photos and accept the policy first.");return}
    const invalid=validateCheckoutDetails(details)
    if(invalid){setError(invalid);return}
    if(!details.city.trim()||!details.state.trim()){setError("Enter your city and state.");return}
    inFlight.current=true;setBusy(true);setError("");setNotice("")
    try{
      const r=await fetch(orderId?"/api/payments/self-build/retry":"/api/payments/self-build/create",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(orderId?{publicOrderId:orderId}:{
          draftId,customerDetails:{...details,
            policyAccepted:true,policyVersion:orderConfig.policyVersion,
            idempotencyKey:key.current,orderType:"hamper",tierId:tier.id,
            selectedProductIds:[],paymentReference:null}
        })
      })
      const response=await r.json() as PaymentReply
      if(response.orderId){
        setOrderId(response.orderId)
        try{sessionStorage.setItem(`celebration:self-build:payment:${customer.account.id}`,response.orderId)}catch{}
      }
      if(!r.ok||!response.ok)throw Error(response.error||"PAYMENT_UNAVAILABLE")
      if(response.paid){setPaid(true);setTrackingPath(response.trackingPath||"");return}
      if(!response.checkout||!response.orderId)throw Error("PAYMENT_NOT_READY")
      const outcome=await launch(response.checkout,response.orderId,details,tier)
      if(outcome.paid){setPaid(true);setTrackingPath(outcome.trackingPath||"")}
      else setNotice("Payment is pending. You can check its status or retry safely.")
    }catch(e){setError(e instanceof Error?e.message:"PAYMENT_UNAVAILABLE")}
    finally{setBusy(false);inFlight.current=false}
  }
  async function refreshPayment(){
    if(!orderId||busy)return
    setBusy(true);setError("")
    try{
      const result=await fetchPayment(orderId)
      if(result.paid){setPaid(true);setTrackingPath(result.trackingPath||"")}
      else setNotice("Payment has not been confirmed yet. Please retry only if it was unsuccessful.")
    }catch{setError("Unable to confirm payment now. Please check again later.")}
    finally{setBusy(false)}
  }
  const disabled=busy||Boolean(orderId)
  return <div className="sbBuyer">
    <div className="sbBuyerTop">
      <div><span className="sbBuyerKicker">CELEBRATION · MADE PERSONAL</span><h1>Build your own hamper</h1>
        <p>Choose the gifts you love. We'll put together the hamper with care, just for your occasion.</p></div>
    </div>
    {error&&<div role="alert" className="sbBuyerMessage sbBuyerError">{error}</div>}
    {notice&&<div role="status" className="sbBuyerMessage">{notice}</div>}
    {customer.loading?<p role="status">Checking your Celebration account…</p>:
    !customer.account?<section className="sbBuyerCard">
      <h2>Sign in to save your gift</h2>
      <p>Your saved choices and personal photos are private to your account.</p>
      <CustomerAuthPanel busy={customer.busy} error={customer.error}
        onAuthenticate={customer.authenticate} onClearError={()=>customer.setError("")} />
    </section>:<>
      {paid?<section className="sbBuyerCard sbBuyerSuccess"><h2>Payment confirmed</h2><p>Your personalised hamper order has been placed.</p>
        <p>Order: <strong>{orderId}</strong></p><Link href={trackingPath||"/account"}>Track your order →</Link>
      </section>:<>
      <section className="sbBuyerTierSection" aria-label="Choose your hamper">
        <h2 className="sbBuyerTierHeading">Choose your hamper</h2>
        <div className="sbBuyerTiers">{tiers.map(t=><button key={t.id} type="button" disabled={disabled}
          className={tierId===t.id?"sbBuyerTierBar sbBuyerTierBar--active":"sbBuyerTierBar"}
          aria-pressed={tierId===t.id} onClick={()=>setTierId(t.id)}>
          <span className="sbBuyerTierName">{t.name}</span>
          <strong className="sbBuyerTierPrice">{formatMoney(hamperFinalPriceRupees(t.price))}</strong>
        </button>)}</div>
      </section>
      <section className="sbBuyerCard"><div className="sbBuyerCardHead"><span>02</span><div><h2>Select categories and sizes</h2>
        <p>Explore the gift categories below. You can choose the same type more than once.</p></div></div>
        <div className={tooManyItems?"sbBuyerCountBar sbBuyerCountBarOver":"sbBuyerCountBar"} role="status" aria-live="polite">
          <div><small>TOTAL PIECES IN YOUR HAMPER</small><strong>{selectedUnits} <span>/ {maxUnits}</span></strong></div>
          <p>Maximum {maxUnits} pieces. Repeat the same category as often as you like, within this total.</p>
        </div>
        <div className="sbBuyerSelectionProgress" role="progressbar" aria-label="Hamper pieces selected"
          aria-valuemin={0} aria-valuemax={maxUnits} aria-valuenow={Math.min(selectedUnits,maxUnits)}>
          <span style={{width:`${maxUnits?Math.min(100,Math.round(selectedUnits/maxUnits*100)):0}%`}} />
        </div>
        {tooManyItems&&<p className="sbBuyerCountError" role="alert">This hamper holds up to {maxUnits} pieces. Remove {selectedUnits-maxUnits} to continue.</p>}
        <div className="sbBuyerChoiceSections">{groupedSections.map(section=><section className="sbBuyerChoiceSection" key={section.title}
          aria-label={section.title}>
          <div className="sbBuyerChoiceSectionHead">
            <h3>{section.title}</h3><span>{section.choices.length} option{section.choices.length===1?"":"s"}</span>
          </div>
          <div className="sbBuyerChoices">{section.choices.map(item=>{
            const count=quantity[item.key]||0
            return <div className={count>0?"sbBuyerChoice sbBuyerChoiceActive":"sbBuyerChoice"} key={item.key}>
              <div><strong>{item.label}</strong>
                {item.kind==="photo"&&<small>One photo upload for each selected piece</small>}
              </div>
              <div className="sbBuyerQty">
                <button type="button" disabled={disabled||count===0} aria-label={`Remove ${item.label}`}
                  onClick={()=>setQuantity(v=>({...v,[item.key]:Math.max(0,count-1)}))}>−</button>
                <output aria-label={`${item.label}: ${count} selected`}>{count}</output>
                <button type="button" disabled={disabled||count>=100||selectedUnits>=maxUnits}
                  aria-label={`Add ${item.label}`} onClick={()=>setQuantity(v=>{
                    const now=Object.values(v).reduce((sum,value)=>sum+Math.max(0,value),0)
                    return now>=maxUnits?v:{...v,[item.key]:Math.min(100,(v[item.key]||0)+1)}
                  })}>+</button>
              </div>
            </div>
          })}</div>
        </section>)}</div>
        {items.length>0&&<div className="sbBuyerSelected" aria-label="Your selected gifts">
          <div className="sbBuyerSelectedHead"><strong>Your selected gifts</strong><span>{selectedUnits} of {maxUnits} pieces</span></div>
          <ul>{items.map(item=><li key={`${item.kind}:${item.id}`}>
            <span>{labelOf(data,item)}</span><b>× {item.quantity}</b>
          </li>)}</ul>
        </div>}
        <label className="sbBuyerField">Any special requests?
          <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1200}
            rows={3} disabled={disabled} placeholder={data.requestPrompt} />
        </label>
        <div className="sbBuyerActions"><button type="button" disabled={disabled||!items.length||tooManyItems}
          onClick={()=>void onSave()}>{busy?"Saving…":"Save my choices"}</button>
          <span role="status" aria-live="polite">{saved?"Saved to your account":"Save before adding photos or paying"}</span></div>
      </section>
      {photoQuantity>0&&<section className="sbBuyerCard"><div className="sbBuyerCardHead"><span>03</span><div><h2>Personalised photos</h2>
        <p>Upload {photoQuantity} photo{photoQuantity===1?"":"s"} securely. Files are deleted from private storage two days after actual delivery.</p></div></div>
        <p className="sbBuyerPhotoStatus" role="status" aria-live="polite">
          {photos.length} of {photoQuantity} photos uploaded{photos.length===photoQuantity?" — all set.":"."}
        </p>
        <label className="sbBuyerPhotoPicker">Add a photo (JPG, PNG or WebP, max 3 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!saved||disabled||photos.length>=photoQuantity}
            onChange={e=>{const file=e.target.files?.[0];if(file)void onPhotoUpload(file);e.currentTarget.value=""}} />
        </label>
        <div className="sbBuyerPhotoList">{photos.map((photo,index)=><div key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Personalised photo ${index+1}`} src={`/api/account/self-build/photos/${encodeURIComponent(photo.id)}`} />
          <button type="button" disabled={disabled} onClick={()=>void removePhoto(photo.id)}>Remove</button>
        </div>)}</div>
      </section>}
      <section className="sbBuyerCard"><div className="sbBuyerCardHead"><span>{photoQuantity>0?"04":"03"}</span><div>
        <h2>Delivery details</h2><p>The date is a preference, not a guaranteed delivery promise.</p></div></div>
        <div className="sbBuyerForm">
          {([["customerName","Your name"],["receiverName","Receiver name"],["address","Full address"],
            ["city","City"],["state","State"],["pincode","PIN code"]] as const).map(([name,label])=>
            <label className="sbBuyerField" key={name}>{label}<input value={details[name]} disabled={Boolean(orderId)||busy}
              autoComplete={({customerName:"name",receiverName:"shipping name",address:"shipping street-address",
                city:"shipping address-level2",state:"shipping address-level1",pincode:"shipping postal-code"} as const)[name]}
              inputMode={name==="pincode"?"numeric":undefined}
              onChange={e=>change(name,e.target.value)} maxLength={name==="pincode"?6:name==="address"?240:100} required /></label>)}
          <label className="sbBuyerField">Preferred delivery date<input type="date" min={todayForDateInput()}
            value={details.requiredDate} disabled={Boolean(orderId)||busy}
            onChange={e=>change("requiredDate",e.target.value)} required /></label>
          <label className="sbBuyerField">Occasion<select value={details.occasion} disabled={Boolean(orderId)||busy}
            onChange={e=>change("occasion",e.target.value)}>
            {occasions.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
          <label className="sbBuyerField">Gift message<textarea rows={2} value={details.message}
            disabled={Boolean(orderId)||busy} maxLength={500}
            onChange={e=>change("message",e.target.value)} /></label>
        </div>
        <label className="sbBuyerAccept"><input type="checkbox" checked={accepted}
          disabled={Boolean(orderId)||busy} onChange={e=>setAccepted(e.target.checked)} />
          I agree to Celebration's order and delivery policies.</label>
        <div className="sbBuyerPay">
          <div className="sbBuyerPaySummary" aria-label="Order total">
            <div className="sbBuyerPayGrand"><small>Final price</small><b>{tier?formatMoney(hamperFinalPriceRupees(tier.price)):"Not available"}</b></div>
          </div>
          <button type="button" disabled={busy||(!orderId&&!readyToPay)}
            onClick={()=>void confirmPayment()}>{busy?"Processing…":orderId?"Retry secure payment":"Continue to secure payment"}</button>
        </div>
        {orderId&&<p className="sbBuyerPending">Order {orderId} saved. If money was deducted, verify your status before retrying.
          <button type="button" disabled={busy} onClick={()=>void refreshPayment()}>Check payment status</button></p>}
      </section>
      </>}
    </>}
  </div>
}
