"use client"

import Link from "next/link"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"
import { formatMoney } from "../../lib/domain/catalog"
import { useMemo, useState } from "react"
import { buildSelfBuildGiftSections } from "../../lib/domain/self-build-choice-sections"
import type { SelfBuildVisualData } from "../../lib/server/self-build-preview"

type Step = "tier" | "categories" | "choose" | "personalise" | "review"
function QuantityControl({ label, count, onChange }: { label: string; count: number; onChange: (count: number) => void }) {
  return <div className={count ? "sbQty sbQty--active" : "sbQty"} aria-label={`Quantity of ${label}`}>
    <button type="button" aria-label={`Remove one ${label}`} disabled={count === 0} onClick={() => onChange(Math.max(0, count - 1))}>−</button>
    <output aria-live="polite" aria-label={`${count} selected`}>{count}</output>
    <button type="button" aria-label={`Add one ${label}`} onClick={() => onChange(count + 1)}>+</button>
  </div>
}

// No illustrated category/product cards: each public option is a selectable name
// with quantity controls. This is presentation-only; IDs and limits are unchanged.
function SelectionCard({ title, group, count, onChange }: {
  title: string
  group?: string
  count: number
  onChange: (count:number)=>void
}) {
  return <div className={count ? "sbChoiceCard sbChoiceCard--selected" : "sbChoiceCard"}>
    <div className="sbChoiceLabel"><h3>{title}</h3>{group&&<span>{group}</span>}</div>
    <QuantityControl label={title} count={count} onChange={onChange} />
  </div>
}

export function SelfBuildDesignPreview({ data, tiers }: {
  data: SelfBuildVisualData
  tiers: {id:string;name:string;maxChoices:number;price:number}[]
}) {
  const [step, setStep] = useState<Step>("tier")
  const [tierId,setTierId]=useState(tiers[0]?.id||"")
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [activeSectionId,setActiveSectionId]=useState<string|null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [message, setMessage] = useState("")
  const sections=useMemo(()=>buildSelfBuildGiftSections(data),[data])
  const notesCategory=data.categories.find(c=>c.selectionKind==="notes")
  // A category click brings that section first, but every category remains
  // present on the next screen, with no accordion, dropdown or hidden products.
  const visibleSections=useMemo(()=>activeSectionId?
    [...sections].sort((a,b)=>Number(b.id===activeSectionId)-Number(a.id===activeSectionId)):
    sections,[sections,activeSectionId])
  const availableChoices=useMemo(()=>sections.flatMap(section=>section.choices.map(choice=>({
    id:choice.key,label:choice.label,kind:choice.kind,groupLabel:section.label
  }))),[sections])
  const chosen=useMemo(()=>availableChoices.map(choice=>({
    ...choice,quantity:quantities[choice.id]??0
  })).filter(choice=>choice.quantity>0),[availableChoices,quantities])
  const units = chosen.reduce((sum, choice) => sum + choice.quantity, 0)
  const distinct = chosen.length
  const tier=tiers.find(item=>item.id===tierId)||tiers[0]
  const maxItems=tier?.maxChoices||0
  const atMax=units>=maxItems
  const exceedsMax=units>maxItems

  const upgradeTier=useMemo(()=>[...tiers].filter(t=>
    t.maxChoices>units && t.maxChoices>maxItems && t.price>(tier?.price||0))
    .sort((a,b)=>a.price-b.price)[0],[tiers,units,maxItems,tier?.price])
  function changeQuantity(id:string,count:number){
    const existing=quantities[id]||0
    if(count>existing && units>=maxItems){setUpgradeOpen(true);return}
    setQuantities(previous=>{
      const prior=previous[id]||0
      const others=Object.values(previous).reduce((sum,value)=>sum+value,0)-prior
      const wanted=Math.max(0,Math.min(100,Math.trunc(count)))
      return {...previous,[id]:wanted<=prior?wanted:Math.min(wanted,Math.max(0,maxItems-others))}
    })
  }
  function chooseTier(id:string){
    const chosenTier=tiers.find(t=>t.id===id)
    if(chosenTier&&units>chosenTier.maxChoices){setUpgradeOpen(true);return}
    setTierId(id)
    setStep("categories")
    setActiveSectionId(null)
    window.scrollTo({top:0,behavior:"auto"})
  }
  function goBack(){
    if(step==="review"){setStep("personalise");return}
    if(step==="personalise"){setStep("choose");return}
    if(step==="choose"){setStep("categories");return}
    if(step==="categories"){setStep("tier");return}
  }
  const title=step==="categories"?"Browse gift categories":
    step==="choose"?"Choose your gifts":
    step==="personalise"?"Add your personal touch":"Your hamper, at a glance"
  const description=step==="categories"?"Choose where to start. Every collection is visible on the next screen.":
    step==="choose"?"Gifts are organised by category. Select any combination you like.":
    step==="personalise"?"Tell us what would make this gift feel personal.":
    "A simple summary of your choices. This is a design preview, not an order."

  return <main className="sbPreviewPage">
    <div className="sbPreviewRibbon" role="status"><span className="sbPreviewRibbonDot" /> ADMIN DESIGN REVIEW <span className="sbRibbonSep">·</span> Not live <span className="sbRibbonSep">·</span> No orders or payments</div>
    <header className="sbPreviewHeader">
      <Link className="sbPreviewBrand" href="/admin" aria-label="Celebration admin home"><span>celebration</span><small>THE GIFT ATELIER</small></Link>
      <div className="sbPreviewHeaderRight"><span>SELF-BUILD HAMPER</span><Link href="/admin">Back to admin <span aria-hidden="true">↗</span></Link></div>
    </header>

    <div className={step==="tier"?"sbPreviewLayout sbPreviewLayout--tier":"sbPreviewLayout"}>
      <div className="sbPreviewMain">
        <div className="sbIntro">
          <h1>{step==="tier"?"Choose your hamper":step==="categories"?"Explore the collections.":step==="choose"?"Make it yours.":"Your personal gift."}</h1>
          <p>{step==="tier"?"Select a hamper to explore the full gift collection.":"Explore by collection, with every gift available."}</p>
        </div>

        <nav className="sbSteps" aria-label="Hamper design steps">
          {([["tier","01","Hamper"],["categories","02","Categories"],
            ["choose","03","Gifts"],["personalise","04","Personalise"],["review","05","Review"]] as const)
            .map(([id,number,label],index)=>{
              const active=(["tier","categories","choose","personalise","review"] as Step[]).indexOf(step)
              return <button type="button" key={id} disabled={index>active}
                onClick={()=>setStep(id)} className={step===id?"sbStep sbStep--current":
                  index<active?"sbStep sbStep--complete":"sbStep"}
                aria-current={step===id?"step":undefined}>
                <span>{number}</span><b>{label}</b><span className="sbStepLine" aria-hidden="true"/>
              </button>
            })}
        </nav>

        <section className="sbSelection" aria-label="Self-build hamper designer">
          {step==="tier"&&<div className="sbPreviewTierStage" role="group" aria-label="Select hamper">
            <h2 className="sbTierPageTitle">Find your perfect fit</h2>
            <div className="sbPreviewTierBars">
              {tiers.map(item=><button key={item.id} type="button" data-tier-id={item.id}
                className="sbPreviewTierBar" onClick={()=>chooseTier(item.id)}>
                <span className="sbPreviewTierName">{item.name}</span>
                <strong className="sbPreviewTierPrice">{formatMoney(hamperFinalPriceRupees(item.price))}</strong>
                <span className="sbPreviewTierArrow" aria-hidden="true">→</span>
              </button>)}
            </div>
          </div>}

          {step!=="tier"&&<div className="sbSelectionHeading">
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <button className="sbBack" type="button" onClick={goBack}>
              <span aria-hidden="true">←</span> Back
            </button>
          </div>}

          {step==="categories"&&<div className="sbCategoryStep" aria-label="Choose a gift collection">
            <div className="sbCategoryMenu">
              {sections.map(section=><button type="button" className="sbCategoryJump" key={section.id}
                onClick={()=>{setActiveSectionId(section.id);setStep("choose");window.scrollTo({top:0,behavior:"auto"})}}>
                <span>{section.label}</span><span aria-hidden="true">→</span>
              </button>)}
            </div>
            <button type="button" className="sbCategoryAll" onClick={()=>{
              setActiveSectionId(null);setStep("choose");window.scrollTo({top:0,behavior:"auto"})
            }}>Explore all gifts <span aria-hidden="true">→</span></button>
          </div>}

          {step==="choose"&&<div className="sbSelectionArea">
            <div className="sbChosenTierLine">
              <span>{tier?.name||"Hamper"}</span>
              <strong>{tier?formatMoney(hamperFinalPriceRupees(tier.price)):"—"}</strong>
              <button type="button" onClick={()=>setStep("tier")}>Change hamper</button>
            </div>
            <div className="sbGiftSections">
              {visibleSections.map(section=><section key={section.id} className="sbGiftSection"
                aria-labelledby={`gift-group-${section.id}`}>
                <h3 id={`gift-group-${section.id}`} className="sbGiftSectionHeading">{section.label}</h3>
                <div className="sbChoiceGrid">
                  {section.choices.map(choice=><SelectionCard key={choice.key}
                    title={choice.label} group={choice.groupLabel===section.label?"":choice.groupLabel}
                    count={quantities[choice.key]||0}
                    onChange={count=>changeQuantity(choice.key,count)}/>)}
                </div>
              </section>)}
            </div>
          </div>}

          {step === "personalise" && <div className="sbPersonalise">
            <div className="sbPersonaliseLabel"><span aria-hidden="true">✳</span><div><h3>A little something extra?</h3><p>We&apos;re here to help make it feel just right.</p></div></div>
            <label htmlFor="sb-custom-note">{notesCategory?.label ?? "Anything else?"}</label>
            <p className="sbInputHint">{data.requestPrompt}</p>
            <textarea id="sb-custom-note" placeholder="For example: a favourite colour, a special occasion, or another little surprise…" rows={6} maxLength={1200} value={message} onChange={event => setMessage(event.target.value)} />
            <div className="sbInputFoot"><span>Optional · We&apos;ll discuss extra requests before confirming them.</span><span>{message.length} / 1200</span></div>
          </div>}

          {step === "review" && <div className="sbReview">
            <div className="sbReviewTop"><span aria-hidden="true">✧</span><h3>A thoughtful beginning.</h3><p>These are the categories and quantities you&apos;ve chosen for your hamper.</p></div>
            <div className="sbReviewList">{chosen.map(item => <div key={item.id}><span>{item.groupLabel && <small>{item.groupLabel} / </small>}{item.label}</span><strong>× {item.quantity}</strong></div>)}</div>
            {message.trim() && <div className="sbReviewNote"><span>YOUR NOTE</span><p>{message.trim()}</p></div>}
            <div className="sbReviewDisclaimer" role="note"><b>Design preview only</b><p>No order, quote or payment is created. Availability, total hamper budget and delivery will be verified when the customer flow is built.</p></div>
          </div>}

          <div className="sbMainControls">
            {step === "choose" && <button className="sbPrimary" type="button" disabled={units === 0 || exceedsMax} onClick={() => setStep("personalise")}>Continue to personalise <span aria-hidden="true">→</span></button>}
            {step === "personalise" && <button className="sbPrimary" type="button" onClick={() => setStep("review")}>Review my hamper <span aria-hidden="true">→</span></button>}
            {step === "review" && <button className="sbPrimary" type="button" onClick={() => setStep("choose")}>Edit gifts <span aria-hidden="true">↗</span></button>}
            <span>{step==="tier"?"":step==="categories"?"Open any collection or browse them all":step==="choose"?units?"Review your choices or continue":"Choose at least one gift type to continue":step==="personalise"?"Your note is optional":"Ordering is disabled in this design review"}</span>
          </div>
        </section>
      </div>

      {step!=="tier"&&<aside className="sbSummary" aria-label="Your hamper preview summary">
        <div className="sbSummaryIn"><div className="sbSummaryHead"><span>YOUR GIFT EDIT</span><span className="sbSummaryOrnament" aria-hidden="true">✳</span></div>
          <h2>Make it<br /><em>personal.</em></h2>
          <p>Each choice is a little part of their story.</p>
          <div className="sbSummaryStats"><div><strong>{distinct.toString().padStart(2, "0")}</strong><span>Selections</span></div><div><strong>{tier?formatMoney(hamperFinalPriceRupees(tier.price)):"—"}</strong><span>Hamper price</span></div></div>
          <div className="sbSummaryDivider"><span>YOUR CHOICES</span><span>{distinct} selected</span></div>
          {chosen.length ? <ul className="sbSummaryItems">{chosen.map(item => <li key={item.id}><span>{item.groupLabel && <small>{item.groupLabel}</small>}{item.label}</span><b>×{item.quantity}</b></li>)}</ul> : <div className="sbSummaryEmpty"><span aria-hidden="true">＋</span><p>Something lovely starts with one choice.</p></div>}
          <div className="sbSummaryPromise"><span aria-hidden="true">✦</span><div><b>Curated with care</b><p>We pick the individual pieces within the categories you select.</p></div></div>
          <p className="sbSummaryLegal">No individual item prices are displayed. No amount is charged in preview.</p>
        </div>
      </aside>}
    </div>

    {upgradeOpen&&<div className="sbUpgradeBackdrop" role="presentation">
      <div className="sbUpgradeModal" role="dialog" aria-modal="true" aria-labelledby="sb-upgrade-title">
        <h2 id="sb-upgrade-title">Choose a larger hamper</h2>
        <p>{upgradeTier?"This gift needs a larger hamper. Upgrade to add more.":"You have reached the selection limit for this hamper."}</p>
        {upgradeTier&&<button className="sbPrimary" type="button" onClick={()=>{
          setTierId(upgradeTier.id);setUpgradeOpen(false)
        }}>Choose {upgradeTier.name} · {formatMoney(hamperFinalPriceRupees(upgradeTier.price))}</button>}
        <button className="sbUpgradeCancel" type="button" onClick={()=>setUpgradeOpen(false)}>Keep my hamper</button>
      </div>
    </div>}
    <footer className="sbPreviewFooter"><span>CELEBRATION · SELF-BUILD DESIGN REVIEW</span><span>Quietly personal. Beautifully considered.</span><Link href="/admin">Exit preview ↗</Link></footer>
  </main>
}
