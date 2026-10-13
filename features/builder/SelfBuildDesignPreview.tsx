"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { SelfBuildVisualCategory, SelfBuildVisualData, SelfBuildVisualOption } from "../../lib/server/self-build-preview"

type Step = "choose" | "personalise" | "review"
type Choice = { id: string; label: string; kind: "category" | "option" | "photo"; groupLabel: string }

function QuantityControl({ label, count, canAdd, onChange }: { label: string; count: number; canAdd: boolean; onChange: (count: number) => void }) {
  return <div className={count ? "sbQty sbQty--active" : "sbQty"} aria-label={`Quantity of ${label}`}>
    <button type="button" aria-label={`Remove one ${label}`} disabled={count === 0} onClick={() => onChange(Math.max(0, count - 1))}>−</button>
    <output aria-live="polite" aria-label={`${count} selected`}>{count}</output>
    <button type="button" aria-label={`Add one ${label}`} disabled={!canAdd} onClick={() => onChange(count + 1)}>+</button>
  </div>
}

function SelectionCard({ title, eyebrow, secondary, index, count, canAdd, onChange }: {
  title: string
  eyebrow: string
  secondary?: string
  index: number
  count: number
  canAdd: boolean
  onChange: (count: number) => void
}) {
  return <article className={count ? "sbChoiceCard sbChoiceCard--selected" : "sbChoiceCard"}>
    <div className="sbChoiceCardTop"><span className="sbIndex">{String(index + 1).padStart(2, "0")}</span><span className="sbChoiceGlyph" aria-hidden="true">✳</span></div>
    <div className="sbChoiceCardBody"><span className="sbMicro">{eyebrow}</span><h3>{title}</h3>{secondary && <p>{secondary}</p>}</div>
    <div className="sbChoiceCardFoot"><span>{count ? "Added to your hamper" : "Choose quantity"}</span><QuantityControl label={title} count={count} canAdd={canAdd} onChange={onChange} /></div>
  </article>
}

function isSelectable(kind: string): kind is Choice["kind"] {
  return kind === "category" || kind === "photo"
}

export function SelfBuildDesignPreview({ data, tiers }: {
  data: SelfBuildVisualData
  tiers: {id:string;name:string;maxChoices:number}[]
}) {
  const [step, setStep] = useState<Step>("choose")
  const [tierId,setTierId]=useState(tiers[0]?.id||"")
  const [openId, setOpenId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [message, setMessage] = useState("")
  const categoryById = useMemo(() => new Map(data.categories.map(category => [category.id, category])), [data.categories])
  const sortedCategories = useMemo(() => [...data.categories].sort((a,b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label)), [data.categories])
  const sortedOptions = useMemo(() => [...data.options].sort((a,b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label)), [data.options])
  const currentCategory = openId ? categoryById.get(openId) : undefined
  const childCategories = sortedCategories.filter(item => item.parentId === (openId ?? null) && item.selectionKind !== "notes")
  const childOptions = currentCategory?.selectionKind === "variant"
    ? sortedOptions.filter(item => item.categoryId === currentCategory.id)
    : []
  const browsingTitle = currentCategory?.label ?? "Choose your categories"
  const notesCategory = sortedCategories.find(c => c.selectionKind === "notes")

  // Explicit category/option IDs only. No SKU or per-item monetary data.
  const availableChoices = useMemo<Choice[]>(() => {
    const categories: Choice[] = data.categories.filter(c => isSelectable(c.selectionKind)).map(c => ({
      id: `category:${c.id}`, label: c.label, kind: c.selectionKind as Choice["kind"],
      groupLabel: c.parentId ? categoryById.get(c.parentId)?.label ?? "" : ""
    }))
    const options: Choice[] = data.options.map(option => ({
      id: `option:${option.id}`, label: option.label, kind: "option",
      groupLabel: categoryById.get(option.categoryId)?.label ?? ""
    }))
    return [...categories, ...options]
  }, [data.categories, data.options, categoryById])

  const chosen = useMemo(() => availableChoices.map(choice => ({ ...choice, quantity: quantities[choice.id] ?? 0 }))
    .filter(choice => choice.quantity > 0), [availableChoices, quantities])
  const units = chosen.reduce((sum, choice) => sum + choice.quantity, 0)
  const distinct = chosen.length
  const tier=tiers.find(item=>item.id===tierId)||tiers[0]
  const maxItems=tier?.maxChoices||0
  const atMax=units>=maxItems
  const exceedsMax=units>maxItems

  function changeQuantity(id: string, count: number) {
    setQuantities(previous=>{
      const existing=previous[id]||0
      const others=Object.values(previous).reduce((sum,value)=>sum+value,0)-existing
      const next=Math.max(0,Math.min(100,Math.trunc(count),Math.max(0,maxItems-others)))
      return {...previous,[id]:next}
    })
  }

  function goBack() {
    if (step === "review") { setStep("personalise"); return }
    if (step === "personalise") { setStep("choose"); return }
    if (currentCategory) { setOpenId(currentCategory.parentId); return }
  }

  const title = step === "choose" ? browsingTitle : step === "personalise" ? "Add your personal touch" : "Your hamper, at a glance"
  const description = step === "choose"
    ? currentCategory ? "Select as many categories or sizes as you like. We'll curate the actual pieces within your choices." : "Start with a category. The details come next."
    : step === "personalise" ? "Tell us what would make this gift feel personal. You can review everything before leaving the preview."
    : "A simple summary of your choices. This is a design preview, not an order."

  return <main className="sbPreviewPage">
    <div className="sbPreviewRibbon" role="status"><span className="sbPreviewRibbonDot" /> ADMIN DESIGN REVIEW <span className="sbRibbonSep">·</span> Not live <span className="sbRibbonSep">·</span> No orders or payments</div>
    <header className="sbPreviewHeader">
      <Link className="sbPreviewBrand" href="/admin" aria-label="Celebration admin home"><span>celebration</span><small>THE GIFT ATELIER</small></Link>
      <div className="sbPreviewHeaderRight"><span>SELF-BUILD HAMPER</span><Link href="/admin">Back to admin <span aria-hidden="true">↗</span></Link></div>
    </header>

    <div className="sbPreviewLayout">
      <div className="sbPreviewMain">
        <div className="sbIntro">
          <div className="sbIntroRule"><span>01 / GIFT SOMETHING PERSONAL</span><span>MADE WITH INTENTION</span></div>
          <h1>Thoughtfully chosen.<br /><em>Beautifully yours.</em></h1>
          <p>Choose the kinds of little joys you&apos;d love to include. Celebration will thoughtfully curate the pieces for your hamper.</p>
        </div>

        <nav className="sbSteps" aria-label="Hamper design steps">
          {([["choose","01","Discover"],["personalise","02","Personalise"],["review","03","Review"]] as const).map(([id,number,label], index) => {
            const stepIndex = (["choose","personalise","review"] as Step[]).indexOf(step)
            return <button type="button" key={id} disabled={index > stepIndex} onClick={() => { setStep(id); if(id === "choose") setOpenId(null) }} className={step === id ? "sbStep sbStep--current" : index < stepIndex ? "sbStep sbStep--complete" : "sbStep"} aria-current={step === id ? "step" : undefined}>
              <span>{number}</span><b>{label}</b><span className="sbStepLine" aria-hidden="true" />
            </button>
          })}
        </nav>

        <section className="sbSelection" aria-label="Self-build hamper designer">
          <div className="sbPreviewLimitBar" role="status" aria-live="polite">
            <label htmlFor="sb-preview-tier">Hamper tier
              <select id="sb-preview-tier" value={tier?.id||""} onChange={event=>setTierId(event.target.value)}>
                {tiers.map(item=><option key={item.id} value={item.id}>{item.name} — up to {item.maxChoices} pieces</option>)}
              </select>
            </label>
            <div><small>MAXIMUM PIECES</small><strong>{units} <span>/ {maxItems}</span></strong>
              <p>Repeating one category also counts toward this total.</p></div>
          </div>
          {exceedsMax&&<p className="sbPreviewLimitError" role="alert">Reduce your selections to {maxItems} pieces for this tier.</p>}
          <div className="sbSelectionHeading">
            <div>
              <span className="sbEyebrow">{step === "choose" ? currentCategory ? "EXPLORE THE COLLECTION" : "YOUR HAMPER BEGINS HERE" : step === "personalise" ? "THE FINISHING TOUCH" : "CURATED AROUND YOU"}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            {(currentCategory || step !== "choose") && <button className="sbBack" type="button" onClick={goBack}><span aria-hidden="true">←</span> Back</button>}
          </div>

          {step === "choose" && <div className="sbSelectionArea">
            {currentCategory && <div className="sbBreadcrumb"><button type="button" onClick={() => setOpenId(null)}>All categories</button><span aria-hidden="true">/</span><b>{currentCategory.label}</b></div>}
            {childCategories.length === 0 && childOptions.length === 0 && <div className="sbNoChoices"><b>Nothing to choose here yet.</b><p>This category will appear once options are enabled by Celebration.</p><button type="button" onClick={goBack}>Explore categories</button></div>}
            <div className="sbChoiceGrid">
              {childCategories.map((category: SelfBuildVisualCategory, index) => {
                if (category.selectionKind === "group" || category.selectionKind === "variant") {
                  const total = category.selectionKind === "group"
                    ? sortedCategories.filter(item => item.parentId === category.id && item.selectionKind !== "notes").length
                    : sortedOptions.filter(item => item.categoryId === category.id).length
                  return <button className="sbExploreCard" type="button" key={category.id} onClick={() => setOpenId(category.id)}>
                    <div className="sbExploreCardTop"><span className="sbIndex">{String(index + 1).padStart(2, "0")}</span><span className="sbCardMotif" aria-hidden="true">✧</span></div>
                    <div className="sbExploreCardBottom"><span className="sbMicro">CELEBRATION COLLECTION</span><h3>{category.label}</h3><p>{total} {category.selectionKind === "group" ? "collections" : "ways to choose"}</p></div>
                    <span className="sbExploreArrow" aria-hidden="true">↗</span>
                  </button>
                }
                const quantityId = `category:${category.id}`
                return <SelectionCard key={category.id} index={index} title={category.label}
                  eyebrow={category.selectionKind === "photo" ? "PERSONALISED MEMORIES" : "CATEGORY SELECTION"}
                  secondary={category.selectionKind === "photo" ? "Add how many photos you'd like. Upload will be available before launch." : "Our team selects the individual pieces for you."}
                  count={quantities[quantityId] ?? 0} canAdd={!atMax} onChange={count => changeQuantity(quantityId,count)} />
              })}
              {childOptions.map((option: SelfBuildVisualOption, index) => {
                const quantityId = `option:${option.id}`
                return <SelectionCard key={option.id} index={index} title={option.label} eyebrow="CHOOSE YOUR SIZE"
                  secondary="Add more than one if you'd like." count={quantities[quantityId] ?? 0}
                  canAdd={!atMax} onChange={count => changeQuantity(quantityId,count)} />
              })}
            </div>
            {childCategories.length > 0 && !currentCategory && <p className="sbGentleNote">Every hamper is assembled by our team. Individual jewellery designs are selected by Celebration within your chosen categories.</p>}
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
            {step === "review" && <button className="sbPrimary" type="button" onClick={() => { setStep("choose");setOpenId(null) }}>Edit categories <span aria-hidden="true">↗</span></button>}
            <span>{step === "choose" ? units ? "Add more categories or continue" : "Choose at least one category to continue" : step === "personalise" ? "Your note is optional" : "Ordering is disabled in this design review"}</span>
          </div>
        </section>
      </div>

      <aside className="sbSummary" aria-label="Your hamper preview summary">
        <div className="sbSummaryIn"><div className="sbSummaryHead"><span>YOUR GIFT EDIT</span><span className="sbSummaryOrnament" aria-hidden="true">✳</span></div>
          <h2>Make it<br /><em>personal.</em></h2>
          <p>Each choice is a little part of their story.</p>
          <div className="sbSummaryStats"><div><strong>{distinct.toString().padStart(2, "0")}</strong><span>Selections</span></div><div><strong>{units}/{maxItems}</strong><span>Pieces</span></div></div>
          <div className="sbSummaryDivider"><span>YOUR CHOICES</span><span>{distinct} selected</span></div>
          {chosen.length ? <ul className="sbSummaryItems">{chosen.map(item => <li key={item.id}><span>{item.groupLabel && <small>{item.groupLabel}</small>}{item.label}</span><b>×{item.quantity}</b></li>)}</ul> : <div className="sbSummaryEmpty"><span aria-hidden="true">＋</span><p>Something lovely starts with one choice.</p></div>}
          <div className="sbSummaryPromise"><span aria-hidden="true">✦</span><div><b>Curated with care</b><p>We pick the individual pieces within the categories you select.</p></div></div>
          <p className="sbSummaryLegal">No individual item prices are displayed. No amount is charged in preview.</p>
        </div>
      </aside>
    </div>

    <footer className="sbPreviewFooter"><span>CELEBRATION · SELF-BUILD DESIGN REVIEW</span><span>Quietly personal. Beautifully considered.</span><Link href="/admin">Exit preview ↗</Link></footer>
  </main>
}
