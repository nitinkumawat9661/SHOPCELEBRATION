"use client"

import { useMemo, useState } from "react"
import type { Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"

type BoxId = "kappa" | "corrugated" | "bag-clear" | "bag-print"
type Stage = 1 | 2 | 3
type CategoryName = "Jewelry" | "Chocolates" | "Teddy Bear" | "Flowers" | "Customised Photos" | "Custom Requirements"
type DeliveryDetails = {
  name: string; phone: string; recipient: string; address: string;
  city: string; state: string; pincode: string; message: string
}

const BOXES: { id: BoxId; label: string; caption: string }[] = [
  { id: "kappa", label: "Kappa Box", caption: "Structured, elegant gifting" },
  { id: "corrugated", label: "Corrugated Normal Box", caption: "Warm, classic presentation" },
  { id: "bag-clear", label: "Hamper Bag – Translucent", caption: "A soft peek inside" },
  { id: "bag-print", label: "Hamper Bag – Printed", caption: "Personal and playful" }
]
const CATEGORIES: CategoryName[] = [
  "Jewelry", "Chocolates", "Teddy Bear", "Flowers", "Customised Photos", "Custom Requirements"
]
const CHOICES: Record<Exclude<CategoryName, "Custom Requirements">, string[]> = {
  Jewelry: ["Necklace", "Necklace Premium", "Necklace + Studs Set", "Ring", "Earrings", "Bangles", "Korean Bangle"],
  Chocolates: ["Starter", "Mini", "Medium", "Large", "Mega"],
  "Teddy Bear": ["Small Teddy", "Medium Teddy", "Large Teddy"],
  Flowers: ["Single Rose", "Rose Bouquet", "Mixed Flowers"],
  "Customised Photos": ["Single Photo", "Photo Pair", "Photo Set"]
}
const categoryHint: Record<CategoryName, string> = {
  Jewelry: "A little sparkle for a memorable moment.",
  Chocolates: "Sweet treats, with a choice of size.",
  "Teddy Bear": "Something adorable to hold close.",
  Flowers: "A warm floral touch for the gift.",
  "Customised Photos": "Make it personal with meaningful memories.",
  "Custom Requirements": "Tell us what would make the surprise feel right."
}
const initialDetails: DeliveryDetails = {
  name: "", phone: "", recipient: "", address: "", city: "", state: "", pincode: "", message: ""
}

function BoxArt({ kind }: { kind: BoxId }) {
  const bag = kind.startsWith("bag")
  return <svg className="sb3BoxArt" viewBox="0 0 260 152" role="img"
    aria-label={bag ? "Minimal gift bag illustration" : "Minimal gift box illustration"}>
    <defs>
      <linearGradient id={`sb3surface-${kind}`} x1="0" x2="1" y1="0" y2="1">
        <stop stopColor={kind === "kappa" ? "#f9e9cd" : "#fff6e6"} />
        <stop offset="1" stopColor={kind === "bag-clear" ? "#eed7ca" : "#d8b79b"} />
      </linearGradient>
      <linearGradient id={`sb3ribbon-${kind}`} x1="0" x2="1">
        <stop stopColor="#bd8270"/><stop offset="1" stopColor="#7a1f24"/>
      </linearGradient>
    </defs>
    <ellipse cx="130" cy="131" rx="78" ry="11" fill="#774133" opacity=".09" />
    {bag ? <>
      <path d="M83 42 Q90 26 108 26 L152 26 Q171 27 178 42 L189 119 Q130 131 71 119 Z"
        fill={`url(#sb3surface-${kind})`} stroke="#b88e79" strokeWidth="1.8" />
      <path d="M107 43 C105 6 155 6 153 43" fill="none" stroke="#9d6e5e" strokeWidth="4" strokeLinecap="round" />
      <path d="M82 48 H179" stroke="#fff9eb" strokeWidth="2" opacity=".65" />
      {kind === "bag-print" ? <>
        <path d="M92 68 q39 -18 76 0 M95 93 q35 17 71 0" fill="none" stroke="#b88676" strokeWidth="1.6" opacity=".8" />
        <path d="M130 69 q-9 -10 -17 -2 q-8 11 17 31 q25 -20 17 -31 q-8 -8 -17 2" fill="#a36c65" opacity=".35" />
      </> : <>
        <rect x="86" y="53" width="88" height="60" rx="7" fill="#fffaf2" opacity=".3"/>
        <path d="M103 83 l18 12 29 -26" fill="none" stroke="#a87b70" opacity=".37" strokeWidth="2"/>
      </>}
      <path d="M130 47 V120" stroke={`url(#sb3ribbon-${kind})`} strokeWidth="7" opacity={kind === "bag-clear" ? ".35" : ".7"} />
    </> : <>
      <path d="M58 68 L129 46 202 69 130 95Z" fill="#f8e9d4" stroke="#bd9f86" strokeWidth="1.6"/>
      <path d="M58 68 V113 L130 138 V95Z" fill={`url(#sb3surface-${kind})`} stroke="#bd9f86" strokeWidth="1.6"/>
      <path d="M202 69 V113 L130 138 V95Z" fill={kind === "kappa" ? "#e5cbb5" : "#e9d7c4"} stroke="#bd9f86" strokeWidth="1.6"/>
      {kind === "kappa" ? <>
        <path d="M114 51 L133 45 L148 51 L128 58Z M116 90 V132 L136 138 V95Z" fill={`url(#sb3ribbon-${kind})`} opacity=".8"/>
        <path d="M128 52 C105 20 97 56 128 59 C158 28 169 58 128 59" fill="none" stroke="#93414b" strokeWidth="4"/>
      </> : <>
        <path d="M69 85 L118 102 M69 95 L118 112 M140 103 L193 83 M140 113 L193 93"
          stroke="#c2a88f" strokeWidth="1" opacity=".9"/>
      </>}
    </>}
  </svg>
}

function enoughForPieces(tiers: Tier[], pieces: number) {
  const sorted = [...tiers].sort((a, b) => a.price - b.price)
  return sorted.find(t => t.maxChoices >= Math.max(1, pieces)) ?? sorted.at(-1)
}

export function SelfBuildThreeScreenPreview({ tiers }: { tiers: Tier[] }) {
  const [stage, setStage] = useState<Stage>(1)
  const [box, setBox] = useState<BoxId | null>(null)
  const [category, setCategory] = useState<CategoryName>("Jewelry")
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [customNote, setCustomNote] = useState("")
  const [photoFileName, setPhotoFileName] = useState("")
  const [details, setDetails] = useState<DeliveryDetails>(initialDetails)
  const [notice, setNotice] = useState("")
  const selectedItems = useMemo(() => Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty, category: id.split("::")[0] || "", label: id.split("::")[1] || id })), [selected])
  const pieces = selectedItems.reduce((sum, item) => sum + item.qty, 0)
  const chosenTier = enoughForPieces(tiers, pieces)
  const previewTotal = chosenTier ? formatMoney(hamperFinalPriceRupees(chosenTier.price)) : "—"
  const selectedBox = BOXES.find(entry => entry.id === box)
  const maxPieces = Math.max(0, ...tiers.map(t => t.maxChoices))

  function jump(next: Stage) {
    setNotice("")
    setStage(next)
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  function adjust(name: CategoryName, label: string, delta: number) {
    const id = `${name}::${label}`
    setSelected(current => {
      const currentCount = current[id] ?? 0
      if (delta > 0 && Object.values(current).reduce((sum, value) => sum + value, 0) >= maxPieces) return current
      return { ...current, [id]: Math.max(0, currentCount + delta) }
    })
  }

  function setField(field: keyof DeliveryDetails, value: string) {
    setDetails(previous => ({ ...previous, [field]: value }))
  }

  return <section className="sb3Flow wrap" aria-label="Create your Celebration Self-Build hamper">
    <header className="sb3Head">
      <span className="sb3Eyebrow">CELEBRATION · CREATE YOUR OWN HAMPER</span>
      <div className="sb3HeadRow">
        <div>
          <h1>{stage === 1 ? "Choose your box" : stage === 2 ? "Choose your gifts" : "Review your hamper"}</h1>
          <p>{stage === 1 ? "Select the presentation style for your hamper" :
            stage === 2 ? "Add your favourites, one category at a time." :
              "A thoughtful surprise, ready for your details."}</p>
        </div>
        <span className="sb3DemoLabel">DESIGN PREVIEW</span>
      </div>
      <div className="sb3Progress" aria-label="Hamper steps">
        {(["Box", "Items", "Review & payment"] as const).map((label, i) => (
          <span key={label} className={stage >= i + 1 ? "active" : ""}>
            <b>{String(i + 1).padStart(2, "0")}</b> {label}
          </span>
        ))}
      </div>
    </header>

    {stage === 1 && <div className="sb3Step sb3ChooseBox">
      <div className="sb3Boxes">
        {BOXES.map(choice => <article className={`sb3BoxCard ${box === choice.id ? "selected" : ""}`} key={choice.id}>
          <div className="sb3BoxVisual"><BoxArt kind={choice.id}/></div>
          <div className="sb3BoxCopy">
            <h2>{choice.label}</h2>
            <p>{choice.caption}</p>
            <button type="button" className={box === choice.id ? "sb3Select active" : "sb3Select"}
              aria-pressed={box === choice.id} onClick={() => { setBox(choice.id); jump(2) }}>
              {box === choice.id ? "Selected" : "Select"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>)}
      </div>
      <p className="sb3Helper">Presentation styles shown as illustrations. Exact box availability and any box-specific charges require confirmation.</p>
    </div>}

    {stage === 2 && <div className="sb3Step">
      <div className="sb3BuilderGrid">
        <div className="sb3BuilderLeft">
          <div className="sb3SectionLabel">
            <span>YOUR GIFT COLLECTION</span><button type="button" onClick={() => jump(1)}>← Change box</button>
          </div>
          <nav className="sb3Categories" aria-label="Gift categories">
            {CATEGORIES.map(item => <button type="button" key={item}
              className={category === item ? "active" : ""} aria-current={category === item ? "page" : undefined}
              onClick={() => setCategory(item)}>{item}</button>)}
          </nav>
          <section className="sb3ItemsPanel" aria-label={category}>
            <div className="sb3PanelHeading"><h2>{category}</h2><p>{categoryHint[category]}</p></div>
            {category === "Custom Requirements" ?
              <label className="sb3Field">Your special requests
                <textarea value={customNote} rows={5} maxLength={1200} onChange={e => setCustomNote(e.target.value)}
                  placeholder="Colours, wrapping, a personal message or something else you have in mind..." />
              </label> :
              <div className="sb3Options">
                {CHOICES[category].map(label => {
                  const qty = selected[`${category}::${label}`] ?? 0
                  return <div className={qty ? "sb3Option picked" : "sb3Option"} key={label}>
                    <div><span className="sb3OptionDot" aria-hidden="true">✦</span><strong>{label}</strong></div>
                    {qty ? <div className="sb3Quantity">
                      <button type="button" aria-label={`Remove ${label}`} onClick={() => adjust(category, label, -1)}>−</button>
                      <output aria-label={`${label}: ${qty} selected`}>{qty}</output>
                      <button type="button" aria-label={`Add ${label}`} disabled={pieces >= maxPieces}
                        onClick={() => adjust(category, label, 1)}>+</button>
                    </div> : <button type="button" className="sb3Add" disabled={pieces >= maxPieces}
                      onClick={() => adjust(category, label, 1)}>Add +</button>}
                  </div>
                })}
              </div>}
            {category === "Customised Photos" && <label className="sb3Field sb3Photos">Preview photo attachment
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={e => setPhotoFileName(e.target.files?.[0]?.name ?? "")}/>
              <small>{photoFileName ? `Selected locally: ${photoFileName}. Not uploaded.` : "Choose an example image. This preview does not upload files."}</small>
            </label>}
          </section>
        </div>
        <aside className="sb3Summary" aria-label="Your selected hamper">
          <span className="sb3Eyebrow">YOUR HAMPER</span>
          <h2>{selectedBox?.label}</h2>
          <p className="sb3SummarySub">{pieces} {pieces === 1 ? "item" : "items"} selected</p>
          <div className="sb3SummaryItems">
            {selectedItems.length ? selectedItems.map(item => <div key={item.id}>
              <span>{item.label}<small>{item.category}</small></span><b>× {item.qty}</b>
            </div>) : <p>No gifts selected yet. Start with a category.</p>}
            {customNote.trim() && <p className="sb3SpecialNote">Special request added</p>}
          </div>
          <div className="sb3Total"><span>Estimated hamper total</span><strong>{previewTotal}</strong></div>
          <p className="sb3EstimateDisclaimer">Budget-tier illustration only. This is not an item-level quote. Box charges and final pricing will be confirmed before checkout.</p>
          <button type="button" className="sb3Primary" disabled={!pieces}
            onClick={() => jump(3)}>Continue <span aria-hidden="true">→</span></button>
          {pieces >= maxPieces && <p className="sb3MaxNotice">Maximum {maxPieces} selected pieces in this preview.</p>}
        </aside>
      </div>
    </div>}

    {stage === 3 && <div className="sb3Step sb3ReviewGrid">
      <div className="sb3ReviewForm">
        <div className="sb3ReviewCard">
          <span className="sb3Eyebrow">YOUR DETAILS</span>
          <h2>Where should we send it?</h2>
          <p>This is a design preview — nothing you enter will be submitted.</p>
          <div className="sb3FormGrid">
            <label className="sb3Field">Your name
              <input value={details.name} autoComplete="name" onChange={e => setField("name", e.target.value)} placeholder="Full name"/>
            </label>
            <label className="sb3Field">Mobile / WhatsApp
              <input value={details.phone} inputMode="tel" autoComplete="tel" onChange={e => setField("phone", e.target.value)}
                placeholder="10-digit mobile number" />
            </label>
            <label className="sb3Field">Receiver name
              <input value={details.recipient} onChange={e => setField("recipient", e.target.value)} placeholder="Recipient name"/>
            </label>
            <label className="sb3Field">PIN code
              <input value={details.pincode} inputMode="numeric" maxLength={6} autoComplete="postal-code"
                onChange={e => setField("pincode", e.target.value.replace(/\D/g, ""))} placeholder="6-digit PIN"/>
            </label>
            <label className="sb3Field wide">Delivery address
              <textarea value={details.address} rows={3} onChange={e => setField("address", e.target.value)}
                placeholder="House number, street and area"/>
            </label>
            <label className="sb3Field">City
              <input value={details.city} autoComplete="address-level2" onChange={e => setField("city", e.target.value)} placeholder="City"/>
            </label>
            <label className="sb3Field">State
              <input value={details.state} autoComplete="address-level1" onChange={e => setField("state", e.target.value)} placeholder="State"/>
            </label>
            <label className="sb3Field wide">Gift message (optional)
              <textarea value={details.message} rows={3} maxLength={500} onChange={e => setField("message", e.target.value)}
                placeholder="A little note to make them smile"/>
            </label>
          </div>
        </div>
        <div className="sb3FormActions">
          <button type="button" className="sb3Secondary" onClick={() => jump(2)}>← Back to items</button>
          <button type="button" className="sb3Primary" onClick={() => setNotice("This is a design preview. Payment is not connected; no order was placed.")}>
            Proceed to Payment <span aria-hidden="true">→</span>
          </button>
        </div>
        {notice && <p className="sb3Notice" role="status">{notice}</p>}
      </div>
      <aside className="sb3Summary sb3ReviewSummary" aria-label="Review hamper">
        <span className="sb3Eyebrow">YOUR CELEBRATION HAMPER</span>
        <h2>{selectedBox?.label}</h2>
        <div className="sb3SummaryItems">
          {selectedItems.map(item => <div key={item.id}>
            <span>{item.label}<small>{item.category}</small></span><b>× {item.qty}</b>
          </div>)}
          {customNote.trim() && <p className="sb3SpecialNote">Special request: {customNote}</p>}
        </div>
        <div className="sb3Total"><span>Estimated total</span><strong>{previewTotal}</strong></div>
        <p className="sb3EstimateDisclaimer">An illustrative tier estimate, not a confirmed payable amount. No checkout or payment will run from this preview.</p>
        <span className="sb3Signature">Mharo Surprise, Thari Smile</span>
      </aside>
    </div>}
  </section>
}
