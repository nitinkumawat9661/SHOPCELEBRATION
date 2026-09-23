"use client"

import { useEffect, useState } from "react"
import { routes } from "../../config/routes"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { defaultCatalog } from "../../lib/domain/catalog"
import type { Campaign, CampaignConfig } from "../../lib/domain/campaign"

const emptyConfig: CampaignConfig = { campaigns: [] }

function localDateTime(value: string) {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function isoDateTime(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ""
}

function newCampaign(): Campaign {
  return {
    id: `offer-${Date.now().toString(36)}`,
    name: "10% Checkout Offer",
    badge: "SPECIAL OFFER",
    message: "A little extra saving on this hamper.",
    active: false,
    trigger: "hesitation",
    audience: "all",
    discountType: "percent",
    discountValue: 10,
    maxDiscountRupees: 0,
    minSubtotalRupees: 499,
    eligibleTierIds: [],
    eligibleProductIds: [],
    startAt: "",
    endAt: "",
    totalLimit: 0,
    perCustomerLimit: 1
  }
}

export function AdminCampaigns() {
  const [config, setConfig] = useState<CampaignConfig>(emptyConfig)
  const [catalog, setCatalog] = useState<CatalogConfig>(defaultCatalog)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setError("")
    const [campaignResponse, catalogResponse] = await Promise.all([
      fetch(routes.api.adminCampaigns, { cache: "no-store" }),
      fetch("/api/catalog", { cache: "no-store" })
    ])
    const campaignData = await campaignResponse.json() as { ok?: boolean; config?: CampaignConfig; version?: number; error?: string }
    const catalogData = await catalogResponse.json() as { ok?: boolean; catalog?: CatalogConfig }
    if (!campaignResponse.ok || !campaignData.ok || !campaignData.config) throw new Error(campaignData.error || "CAMPAIGNS_LOAD_FAILED")
    setConfig(campaignData.config)
    setVersion(campaignData.version || 0)
    if (catalogResponse.ok && catalogData.ok && catalogData.catalog) setCatalog(catalogData.catalog)
    setDirty(false)
  }

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "CAMPAIGNS_LOAD_FAILED")) }, [])

  function replace(index: number, next: Campaign) {
    setConfig((current) => ({ campaigns: current.campaigns.map((item, itemIndex) => itemIndex === index ? next : item) }))
    setDirty(true)
  }

  function patch<K extends keyof Campaign>(index: number, key: K, value: Campaign[K]) {
    replace(index, { ...config.campaigns[index], [key]: value })
  }

  function toggleList(index: number, key: "eligibleTierIds" | "eligibleProductIds", value: string) {
    const current = config.campaigns[index][key]
    patch(index, key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function add() {
    setConfig((current) => ({ campaigns: [...current.campaigns, newCampaign()] }))
    setDirty(true)
  }

  function remove(index: number) {
    setConfig((current) => ({ campaigns: current.campaigns.filter((_, itemIndex) => itemIndex !== index) }))
    setDirty(true)
  }

  async function save() {
    setBusy(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch(routes.api.adminCampaigns, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      })
      const data = await response.json() as { ok?: boolean; config?: CampaignConfig; version?: number; error?: string }
      if (!response.ok || !data.ok || !data.config) throw new Error(data.error || "CAMPAIGNS_SAVE_FAILED")
      setConfig(data.config)
      setVersion(data.version || version + 1)
      setDirty(false)
      setNotice("Offer rules published. Checkout will use these rules immediately.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CAMPAIGNS_SAVE_FAILED")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adminWorkspaceCard adminCampaignWorkspace">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">CAMPAIGNS</div><h2>Automatic offers</h2><p>Create real discounts with server-validated pricing. Best eligible offer wins; offers never stack.</p></div>
        <div className="adminActions"><button className="secondary" type="button" onClick={add}>+ Add offer</button><button className="secondary" type="button" onClick={() => load().catch((cause) => setError(String(cause)))}>Reload</button><button className="primary" type="button" disabled={busy || !dirty} onClick={save}>{busy ? "Publishing…" : `Publish v${version + 1}`}</button></div>
      </div>
      {dirty && <div className="adminDraftNotice">Unpublished changes • Live checkout still uses the previous campaign rules.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}
      <div className="adminCampaignGuide"><b>Checkout</b> checks immediately after login. <b>Hesitation</b> checks after 12 seconds on payment when no checkout offer matched. Usage limits reserve a quote for 60 minutes.</div>

      {config.campaigns.length === 0 && <div className="trackingState">No campaigns yet. Add one when you want to run a genuine offer.</div>}
      <div className="adminCampaignList">
        {config.campaigns.map((campaign, index) => <article className={`adminCampaignCard ${campaign.active ? "active" : ""}`} key={`${campaign.id}-${index}`}>
          <header><div><span>{campaign.active ? "LIVE WHEN ELIGIBLE" : "DRAFT / OFF"}</span><h3>{campaign.name}</h3><small>{campaign.id}</small></div><label className="adminToggle"><input type="checkbox" checked={campaign.active} onChange={(event) => patch(index, "active", event.target.checked)} /><span>Active</span></label></header>
          <div className="adminSettingsGrid campaignBasics">
            <label>Campaign ID<input value={campaign.id} maxLength={60} onChange={(event) => patch(index, "id", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></label>
            <label>Name<input value={campaign.name} maxLength={100} onChange={(event) => patch(index, "name", event.target.value)} /></label>
            <label>Badge<input value={campaign.badge} maxLength={40} onChange={(event) => patch(index, "badge", event.target.value)} /></label>
            <label>Trigger<select value={campaign.trigger} onChange={(event) => patch(index, "trigger", event.target.value as Campaign["trigger"])}><option value="checkout">Checkout</option><option value="hesitation">Hesitation</option></select></label>
            <label>Audience<select value={campaign.audience} onChange={(event) => patch(index, "audience", event.target.value as Campaign["audience"])}><option value="all">Everyone</option><option value="first_order">First order only</option></select></label>
            <label>Discount type<select value={campaign.discountType} onChange={(event) => patch(index, "discountType", event.target.value as Campaign["discountType"])}><option value="percent">Percent</option><option value="fixed">Fixed ₹</option></select></label>
            <label>Discount value<input type="number" min={1} value={campaign.discountValue} onChange={(event) => patch(index, "discountValue", Number(event.target.value))} /><small>{campaign.discountType === "percent" ? "% off" : "Rupees off"}</small></label>
            <label>Max discount ₹<input type="number" min={0} value={campaign.maxDiscountRupees} onChange={(event) => patch(index, "maxDiscountRupees", Number(event.target.value))} /><small>0 = no extra cap</small></label>
            <label>Minimum hamper ₹<input type="number" min={0} value={campaign.minSubtotalRupees} onChange={(event) => patch(index, "minSubtotalRupees", Number(event.target.value))} /></label>
            <label>Total uses<input type="number" min={0} value={campaign.totalLimit} onChange={(event) => patch(index, "totalLimit", Number(event.target.value))} /><small>0 = unlimited</small></label>
            <label>Uses per customer<input type="number" min={0} value={campaign.perCustomerLimit} onChange={(event) => patch(index, "perCustomerLimit", Number(event.target.value))} /><small>0 = unlimited</small></label>
            <label>Starts<input type="datetime-local" value={localDateTime(campaign.startAt)} onChange={(event) => patch(index, "startAt", isoDateTime(event.target.value))} /></label>
            <label>Ends<input type="datetime-local" value={localDateTime(campaign.endAt)} onChange={(event) => patch(index, "endAt", isoDateTime(event.target.value))} /></label>
            <label className="adminWide">Customer message<input value={campaign.message} maxLength={180} onChange={(event) => patch(index, "message", event.target.value)} /></label>
          </div>

          <div className="campaignEligibility">
            <div><b>Eligible hampers</b><small>Nothing selected = all active hampers.</small><div className="campaignChoiceGrid">{catalog.tiers.filter((tier) => tier.active !== false).map((tier) => <label key={tier.id}><input type="checkbox" checked={campaign.eligibleTierIds.includes(tier.id)} onChange={() => toggleList(index, "eligibleTierIds", tier.id)} /><span>₹{tier.price} • {tier.name}</span></label>)}</div></div>
            <div><b>Eligible products</b><small>Nothing selected = any product mix. If selected, at least one selected gift must match.</small><div className="campaignChoiceGrid campaignProducts">{catalog.products.filter((product) => product.active !== false).map((product) => <label key={product.id}><input type="checkbox" checked={campaign.eligibleProductIds.includes(product.id)} onChange={() => toggleList(index, "eligibleProductIds", product.id)} /><span>{product.name}</span></label>)}</div></div>
          </div>
          <footer><div className="adminCampaignPreview"><span>{campaign.badge}</span><b>{campaign.name}</b><small>{campaign.message}</small></div><button className="dangerButton" type="button" onClick={() => remove(index)}>Delete offer</button></footer>
        </article>)}
      </div>
    </section>
  )
}
